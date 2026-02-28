# ─── LAMBDA ROLE ──────────────────────────────────────────────────────────────

resource "aws_iam_role" "lambda" {
  name = "${var.project_name}-${var.environment}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.tags
}

resource "aws_iam_role_policy" "lambda_policy" {
  name = "${var.project_name}-${var.environment}-lambda-policy"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:Query",
          "dynamodb:Scan", "dynamodb:UpdateItem", "dynamodb:DeleteItem"
        ]
        Resource = [
          aws_dynamodb_table.sensor_readings.arn,
          aws_dynamodb_table.locations.arn,
          aws_dynamodb_table.ai_analysis.arn
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["iot:Publish"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["kinesis:GetRecords", "kinesis:GetShardIterator", "kinesis:DescribeStream", "kinesis:ListStreams", "kinesis:ListShards"]
        Resource = aws_kinesis_stream.rekognition_output.arn
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.main.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = aws_s3_bucket.main.arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject", "s3:GetObject", "s3:GetBucketLocation",
          "s3:ListBucket", "s3:AbortMultipartUpload", "s3:ListBucketMultipartUploads"
        ]
        Resource = [
          aws_s3_bucket.athena_results.arn,
          "${aws_s3_bucket.athena_results.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "athena:StartQueryExecution", "athena:GetQueryExecution",
          "athena:GetQueryResults", "athena:StopQueryExecution",
          "athena:GetWorkGroup", "athena:ListQueryExecutions"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "glue:GetDatabase", "glue:GetDatabases",
          "glue:GetTable", "glue:GetTables",
          "glue:GetPartitions", "glue:CreatePartition", "glue:BatchCreatePartition"
        ]
        Resource = "*"
      }
    ]
  })
}

# ─── REKOGNITION ROLE ─────────────────────────────────────────────────────────

resource "aws_iam_role" "rekognition" {
  name = "${var.project_name}-${var.environment}-rekognition-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "rekognition.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.tags
}

resource "aws_iam_role_policy" "rekognition_policy" {
  name = "${var.project_name}-${var.environment}-rekognition-policy"
  role = aws_iam_role.rekognition.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["kinesisvideo:GetDataEndpoint", "kinesisvideo:GetMedia", "kinesisvideo:DescribeStream"]
        Resource = [for stream in aws_kinesis_video_stream.locations : stream.arn]
      },
      {
        Effect   = "Allow"
        Action   = ["kinesis:PutRecord", "kinesis:PutRecords"]
        Resource = aws_kinesis_stream.rekognition_output.arn
      },
      {
        Effect   = "Allow"
        Action   = ["sns:Publish"]
        Resource = aws_sns_topic.rekognition_alerts.arn
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject"]
        Resource = "${aws_s3_bucket.main.arn}/rekognition-frames/*"
      }
    ]
  })
}

# ─── COGNITO AUTHENTICATED ROLE ───────────────────────────────────────────────

resource "aws_iam_role" "cognito_authenticated" {
  name = "${var.project_name}-${var.environment}-cognito-auth-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Federated = "cognito-identity.amazonaws.com" }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
        }
        "ForAnyValue:StringLike" = {
          "cognito-identity.amazonaws.com:amr" = "authenticated"
        }
      }
    }]
  })

  tags = local.tags
}

resource "aws_iam_role_policy" "cognito_authenticated_policy" {
  name = "${var.project_name}-${var.environment}-cognito-auth-policy"
  role = aws_iam_role.cognito_authenticated.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "${aws_s3_bucket.main.arn}/frames/*"
      },
      {
        Effect   = "Allow"
        Action   = ["iot:Connect", "iot:Subscribe", "iot:Receive"]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role" "cognito_unauthenticated" {
  name = "${var.project_name}-${var.environment}-cognito-unauth-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Federated = "cognito-identity.amazonaws.com" }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
        }
        "ForAnyValue:StringLike" = {
          "cognito-identity.amazonaws.com:amr" = "unauthenticated"
        }
      }
    }]
  })

  tags = local.tags
}

resource "aws_iam_role_policy" "cognito_unauthenticated_policy" {
  name = "${var.project_name}-${var.environment}-cognito-unauth-policy"
  role = aws_iam_role.cognito_unauthenticated.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Deny"
      Action   = "*"
      Resource = "*"
    }]
  })
}

# ─── PI DEVICE IAM USER (for aws configure on Pi) ────────────────────────────

resource "aws_iam_user" "pi_device" {
  name = "${var.project_name}-${var.environment}-pi-device"
  tags = local.tags
}

resource "aws_iam_access_key" "pi_device" {
  user = aws_iam_user.pi_device.name
}

resource "aws_iam_user_policy" "pi_device_policy" {
  name = "${var.project_name}-${var.environment}-pi-device-policy"
  user = aws_iam_user.pi_device.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["kinesisvideo:*"]
        Resource = [for stream in aws_kinesis_video_stream.locations : stream.arn]
      },
      {
        Effect   = "Allow"
        Action   = ["iot:Connect", "iot:Publish"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject"]
        Resource = "${aws_s3_bucket.main.arn}/frames/*"
      }
    ]
  })
}

# ─── FIREHOSE ROLE ────────────────────────────────────────────────────────────

resource "aws_iam_role" "firehose" {
  name = "${var.project_name}-${var.environment}-firehose-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "firehose.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.tags
}

resource "aws_iam_role_policy" "firehose_policy" {
  name = "${var.project_name}-${var.environment}-firehose-policy"
  role = aws_iam_role.firehose.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "kinesis:GetRecords", "kinesis:GetShardIterator",
          "kinesis:DescribeStream", "kinesis:DescribeStreamSummary",
          "kinesis:ListShards", "kinesis:ListStreams",
          "kinesis:SubscribeToShard"
        ]
        Resource = aws_kinesis_stream.rekognition_output.arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:AbortMultipartUpload", "s3:GetBucketLocation",
          "s3:GetObject", "s3:ListBucket",
          "s3:ListBucketMultipartUploads", "s3:PutObject"
        ]
        Resource = [
          aws_s3_bucket.main.arn,
          "${aws_s3_bucket.main.arn}/*"
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}
