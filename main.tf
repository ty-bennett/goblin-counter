terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

# ─── S3 ───────────────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "main" {
  bucket        = "${var.project_name}-${var.environment}-${data.aws_caller_identity.current.account_id}"
  force_destroy = true

  tags = local.tags
}

resource "aws_s3_bucket_cors_configuration" "main" {
  bucket = aws_s3_bucket.main.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_public_access_block" "main" {
  bucket                  = aws_s3_bucket.main.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ─── COGNITO ──────────────────────────────────────────────────────────────────

resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-${var.environment}-users"

  auto_verified_attributes = ["email"]
  username_attributes      = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = false
  }

  schema {
    name                     = "email"
    attribute_data_type      = "String"
    required                 = true
    mutable                  = true
    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  tags = local.tags
}

resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.project_name}-web-client"
  user_pool_id = aws_cognito_user_pool.main.id

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]

  prevent_user_existence_errors = "ENABLED"
  refresh_token_validity        = 30
  access_token_validity         = 1
  id_token_validity             = 1

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }
}

resource "aws_cognito_user_group" "admin" {
  name         = "admin"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Admin users with full access"
}

resource "aws_cognito_user_group" "viewer" {
  name         = "viewer"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Read-only viewers"
}

# Identity pool for S3 presigned URL access
resource "aws_cognito_identity_pool" "main" {
  identity_pool_name               = "${var.project_name}_${var.environment}_identity"
  allow_unauthenticated_identities = false

  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.web.id
    provider_name           = aws_cognito_user_pool.main.endpoint
    server_side_token_check = false
  }
}

resource "aws_cognito_identity_pool_roles_attachment" "main" {
  identity_pool_id = aws_cognito_identity_pool.main.id

  roles = {
    authenticated   = aws_iam_role.cognito_authenticated.arn
    unauthenticated = aws_iam_role.cognito_unauthenticated.arn
  }
}

# ─── DYNAMODB ─────────────────────────────────────────────────────────────────

resource "aws_dynamodb_table" "sensor_readings" {
  name         = "${var.project_name}-${var.environment}-sensor-readings"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "locationId"
  range_key    = "timestamp"

  attribute {
    name = "locationId"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  tags = local.tags
}

resource "aws_dynamodb_table" "locations" {
  name         = "${var.project_name}-${var.environment}-locations"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "locationId"

  attribute {
    name = "locationId"
    type = "S"
  }

  tags = local.tags
}

resource "aws_dynamodb_table" "ai_analysis" {
  name         = "${var.project_name}-${var.environment}-ai-analysis"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "locationId"
  range_key    = "timestamp"

  attribute {
    name = "locationId"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  tags = local.tags
}

# ─── IOT CORE ─────────────────────────────────────────────────────────────────

resource "aws_iot_policy" "device_policy" {
  name = "${var.project_name}-${var.environment}-device-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["iot:Connect", "iot:Publish", "iot:Subscribe", "iot:Receive"]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iot_thing" "camera_pi" {
  name = "${var.project_name}-camera-pi-01"
}

# IoT Rule → Lambda ingest
resource "aws_iot_topic_rule" "camera_ingest" {
  name        = "${replace(var.project_name, "-", "_")}_camera_ingest"
  enabled     = true
  sql         = "SELECT * FROM 'sensors/camera/+/frame'"
  sql_version = "2016-03-23"

  lambda {
    function_arn = aws_lambda_function.ingest.arn
  }
}

resource "aws_lambda_permission" "iot_invoke_ingest" {
  statement_id  = "AllowIoTInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ingest.function_name
  principal     = "iot.amazonaws.com"
  source_arn    = aws_iot_topic_rule.camera_ingest.arn
}

# ─── KINESIS VIDEO STREAMS ────────────────────────────────────────────────────

resource "aws_kinesis_video_stream" "locations" {
  for_each = toset(var.location_ids)

  name                    = "${var.project_name}-${var.environment}-${each.key}"
  data_retention_in_hours = 2
  media_type              = "video/h264"

  tags = local.tags
}

# Kinesis Data Stream for Rekognition output
resource "aws_kinesis_stream" "rekognition_output" {
  name             = "${var.project_name}-${var.environment}-rekognition-output"
  shard_count      = 1
  retention_period = 24

  tags = local.tags
}

# ─── REKOGNITION STREAM PROCESSORS ───────────────────────────────────────────

resource "aws_rekognition_stream_processor" "locations" {
  for_each = toset(var.location_ids)

  name     = "${var.project_name}-${var.environment}-${each.key}-processor"
  role_arn = aws_iam_role.rekognition.arn

  input {
    kinesis_video_stream {
      arn = aws_kinesis_video_stream.locations[each.key].arn
    }
  }

  # ConnectedHome processors output to S3 only (not Kinesis data stream).
  # The rekognition_processor Lambda reads the S3 events via SNS/EventBridge.
  output {
    s3_destination {
      bucket     = aws_s3_bucket.main.bucket
      key_prefix = "rekognition-frames/${each.key}/"
    }
  }

  settings {
    connected_home {
      labels          = ["PERSON"]
      min_confidence  = 70
    }
  }

  notification_channel {
    sns_topic_arn = aws_sns_topic.rekognition_alerts.arn
  }

  # Explicitly declare to avoid provider bug that toggles this block on every apply
  data_sharing_preference {
    opt_in = false
  }

  tags = local.tags
}

# ─── SNS ──────────────────────────────────────────────────────────────────────

resource "aws_sns_topic" "rekognition_alerts" {
  name = "${var.project_name}-${var.environment}-rekognition-alerts"
  tags = local.tags
}

# ─── LAMBDA FUNCTIONS ─────────────────────────────────────────────────────────

# Placeholder zip — replace with real code
data "archive_file" "lambda_placeholder" {
  type        = "zip"
  output_path = "/tmp/lambda_placeholder.zip"

  source {
    content  = "def handler(event, context): return {'statusCode': 200}"
    filename = "index.py"
  }
}

# Ingest Lambda — receives IoT Core events
resource "aws_lambda_function" "ingest" {
  function_name    = "${var.project_name}-${var.environment}-ingest"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.lambda_placeholder.output_path
  source_code_hash = data.archive_file.lambda_placeholder.output_base64sha256
  timeout          = 30

  environment {
    variables = {
      READINGS_TABLE = aws_dynamodb_table.sensor_readings.name
      LOCATIONS_TABLE = aws_dynamodb_table.locations.name
      REGION         = var.region
    }
  }

  tags = local.tags
}

# Rekognition Results Lambda — triggered by Kinesis Data Stream
resource "aws_lambda_function" "rekognition_processor" {
  function_name    = "${var.project_name}-${var.environment}-rekognition-processor"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.lambda_placeholder.output_path
  source_code_hash = data.archive_file.lambda_placeholder.output_base64sha256
  timeout          = 60

  environment {
    variables = {
      READINGS_TABLE = aws_dynamodb_table.sensor_readings.name
      IOT_ENDPOINT   = data.aws_iot_endpoint.current.endpoint_address
      S3_BUCKET      = aws_s3_bucket.main.bucket
      REGION         = var.region
    }
  }

  tags = local.tags
}

# ConnectedHome processors publish to SNS; subscribe the Lambda to receive events.
# The SNS message body contains the S3 key where Rekognition wrote the result JSON.
resource "aws_sns_topic_subscription" "rekognition_to_lambda" {
  topic_arn = aws_sns_topic.rekognition_alerts.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.rekognition_processor.arn
}

resource "aws_lambda_permission" "sns_invoke_rekognition_processor" {
  statement_id  = "AllowSNSInvokeRekognitionProcessor"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.rekognition_processor.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.rekognition_alerts.arn
}

# Bedrock Analyzer Lambda — runs on schedule
resource "aws_lambda_function" "bedrock_analyzer" {
  function_name    = "${var.project_name}-${var.environment}-bedrock-analyzer"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.lambda_placeholder.output_path
  source_code_hash = data.archive_file.lambda_placeholder.output_base64sha256
  timeout          = 120

  environment {
    variables = {
      READINGS_TABLE  = aws_dynamodb_table.sensor_readings.name
      ANALYSIS_TABLE  = aws_dynamodb_table.ai_analysis.name
      LOCATIONS_TABLE = aws_dynamodb_table.locations.name
      BEDROCK_MODEL   = var.bedrock_model_id
      REGION          = var.region
    }
  }

  tags = local.tags
}

# EventBridge schedule — run Bedrock analyzer every 5 minutes
resource "aws_cloudwatch_event_rule" "bedrock_schedule" {
  name                = "${var.project_name}-${var.environment}-bedrock-schedule"
  schedule_expression = "rate(5 minutes)"
  tags                = local.tags
}

resource "aws_cloudwatch_event_target" "bedrock_schedule" {
  rule      = aws_cloudwatch_event_rule.bedrock_schedule.name
  target_id = "BedrockAnalyzer"
  arn       = aws_lambda_function.bedrock_analyzer.arn
}

resource "aws_lambda_permission" "eventbridge_invoke_bedrock" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.bedrock_analyzer.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.bedrock_schedule.arn
}

# Chat Lambda — handles conversational queries
resource "aws_lambda_function" "chat" {
  function_name    = "${var.project_name}-${var.environment}-chat"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.lambda_placeholder.output_path
  source_code_hash = data.archive_file.lambda_placeholder.output_base64sha256
  timeout          = 60

  environment {
    variables = {
      READINGS_TABLE        = aws_dynamodb_table.sensor_readings.name
      ANALYSIS_TABLE        = aws_dynamodb_table.ai_analysis.name
      LOCATIONS_TABLE       = aws_dynamodb_table.locations.name
      BEDROCK_MODEL         = var.bedrock_model_id
      ATHENA_WORKGROUP      = aws_athena_workgroup.main.name
      ATHENA_DATABASE       = aws_glue_catalog_database.main.name
      ATHENA_RESULTS_BUCKET = aws_s3_bucket.athena_results.bucket
      REGION                = var.region
    }
  }

  tags = local.tags
}

# API Lambda — general REST handler
resource "aws_lambda_function" "api" {
  function_name    = "${var.project_name}-${var.environment}-api"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.lambda_placeholder.output_path
  source_code_hash = data.archive_file.lambda_placeholder.output_base64sha256
  timeout          = 30

  environment {
    variables = {
      READINGS_TABLE  = aws_dynamodb_table.sensor_readings.name
      ANALYSIS_TABLE  = aws_dynamodb_table.ai_analysis.name
      LOCATIONS_TABLE = aws_dynamodb_table.locations.name
      S3_BUCKET       = aws_s3_bucket.main.bucket
      REGION          = var.region
    }
  }

  tags = local.tags
}

# ─── API GATEWAY ──────────────────────────────────────────────────────────────

resource "aws_apigatewayv2_api" "main" {
  name          = "${var.project_name}-${var.environment}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["*"]
    max_age       = 300
  }

  tags = local.tags
}

resource "aws_apigatewayv2_stage" "main" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = var.environment
  auto_deploy = true

  tags = local.tags
}

resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-authorizer"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.web.id]
    issuer   = "https://cognito-idp.${var.region}.amazonaws.com/${aws_cognito_user_pool.main.id}"
  }
}

# Lambda integrations
resource "aws_apigatewayv2_integration" "api" {
  api_id             = aws_apigatewayv2_api.main.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.api.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_integration" "chat" {
  api_id             = aws_apigatewayv2_api.main.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.chat.invoke_arn
  integration_method = "POST"
}

# Routes
resource "aws_apigatewayv2_route" "get_locations" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /locations"
  target             = "integrations/${aws_apigatewayv2_integration.api.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  authorization_type = "JWT"
}

resource "aws_apigatewayv2_route" "get_location_metrics" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /locations/{id}/metrics"
  target             = "integrations/${aws_apigatewayv2_integration.api.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  authorization_type = "JWT"
}

resource "aws_apigatewayv2_route" "get_location_analysis" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /locations/{id}/analysis"
  target             = "integrations/${aws_apigatewayv2_integration.api.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  authorization_type = "JWT"
}

resource "aws_apigatewayv2_route" "post_chat" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /chat"
  target             = "integrations/${aws_apigatewayv2_integration.chat.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  authorization_type = "JWT"
}

resource "aws_lambda_permission" "api_gw_api" {
  statement_id  = "AllowAPIGWInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gw_chat" {
  statement_id  = "AllowAPIGWInvokeChat"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.chat.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# ─── DATA SOURCES ─────────────────────────────────────────────────────────────

data "aws_caller_identity" "current" {}
data "aws_iot_endpoint" "current" {
  endpoint_type = "iot:Data-ATS"
}

# ─── ATHENA QUERY LAMBDA ──────────────────────────────────────────────────────
# Receives natural-language or structured queries, uses Bedrock to resolve the
# target location, runs Athena SQL, and returns historical busyness data.

resource "aws_lambda_function" "athena_query" {
  function_name    = "${var.project_name}-${var.environment}-athena-query"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.lambda_placeholder.output_path
  source_code_hash = data.archive_file.lambda_placeholder.output_base64sha256
  timeout          = 60

  environment {
    variables = {
      ATHENA_WORKGROUP      = aws_athena_workgroup.main.name
      ATHENA_DATABASE       = aws_glue_catalog_database.main.name
      ATHENA_RESULTS_BUCKET = aws_s3_bucket.athena_results.bucket
      READINGS_TABLE        = aws_dynamodb_table.sensor_readings.name
      LOCATIONS_TABLE       = aws_dynamodb_table.locations.name
      BEDROCK_MODEL         = var.bedrock_model_id
      REGION                = var.region
    }
  }

  tags = local.tags
}

resource "aws_apigatewayv2_integration" "athena_query" {
  api_id             = aws_apigatewayv2_api.main.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.athena_query.invoke_arn
  integration_method = "POST"
}

# POST /query — LLM resolves location from natural language, runs Athena SQL
resource "aws_apigatewayv2_route" "post_query" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /query"
  target             = "integrations/${aws_apigatewayv2_integration.athena_query.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  authorization_type = "JWT"
}

# POST /locations — create / register a new location
resource "aws_apigatewayv2_route" "post_locations" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /locations"
  target             = "integrations/${aws_apigatewayv2_integration.api.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  authorization_type = "JWT"
}

# GET /locations/{id} — fetch a single location record
resource "aws_apigatewayv2_route" "get_location" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /locations/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.api.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  authorization_type = "JWT"
}

# GET /locations/{id}/busyness — real-time busyness level from latest DynamoDB record
resource "aws_apigatewayv2_route" "get_location_busyness" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /locations/{id}/busyness"
  target             = "integrations/${aws_apigatewayv2_integration.api.id}"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
  authorization_type = "JWT"
}

resource "aws_lambda_permission" "api_gw_athena_query" {
  statement_id  = "AllowAPIGWInvokeAthenaQuery"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.athena_query.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
