# ─── API ──────────────────────────────────────────────────────────────────────

output "api_endpoint" {
  description = "API Gateway endpoint URL"
  value       = "${aws_apigatewayv2_stage.main.invoke_url}"
}

# ─── COGNITO ──────────────────────────────────────────────────────────────────

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.main.id
}

output "cognito_user_pool_client_id" {
  description = "Cognito User Pool Client ID"
  value       = aws_cognito_user_pool_client.web.id
}

output "cognito_identity_pool_id" {
  description = "Cognito Identity Pool ID"
  value       = aws_cognito_identity_pool.main.id
}

# ─── S3 ───────────────────────────────────────────────────────────────────────

output "s3_bucket_name" {
  description = "S3 bucket name"
  value       = aws_s3_bucket.main.bucket
}

# ─── IOT ──────────────────────────────────────────────────────────────────────

output "iot_endpoint" {
  description = "IoT Core endpoint for Pi MQTT connection"
  value       = data.aws_iot_endpoint.current.endpoint_address
}

# ─── KVS ──────────────────────────────────────────────────────────────────────

output "kvs_stream_arns" {
  description = "Kinesis Video Stream ARNs per location"
  value       = { for k, v in aws_kinesis_video_stream.locations : k => v.arn }
}

# ─── DYNAMODB ─────────────────────────────────────────────────────────────────

output "dynamodb_tables" {
  description = "DynamoDB table names"
  value = {
    sensor_readings = aws_dynamodb_table.sensor_readings.name
    locations       = aws_dynamodb_table.locations.name
    ai_analysis     = aws_dynamodb_table.ai_analysis.name
  }
}

# ─── AMPLIFY (disabled — see amplify.tf) ──────────────────────────────────────
# output "amplify_app_id" { ... }
# output "amplify_app_url" { ... }

# ─── ATHENA ───────────────────────────────────────────────────────────────────

output "athena_workgroup" {
  description = "Athena workgroup name"
  value       = aws_athena_workgroup.main.name
}

output "athena_database" {
  description = "Glue/Athena database name"
  value       = aws_glue_catalog_database.main.name
}

output "athena_results_bucket" {
  description = "S3 bucket for Athena query results"
  value       = aws_s3_bucket.athena_results.bucket
}

# ─── PI DEVICE CREDENTIALS ────────────────────────────────────────────────────

output "pi_device_access_key_id" {
  description = "Access key ID for Pi device — use with aws configure"
  value       = aws_iam_access_key.pi_device.id
}

output "pi_device_secret_access_key" {
  description = "Secret access key for Pi device — use with aws configure"
  value       = aws_iam_access_key.pi_device.secret
  sensitive   = true
}

# ─── FRONTEND ENV VARS ────────────────────────────────────────────────────────

output "frontend_env" {
  description = "Paste these into your .env file for the React frontend"
  value = <<-EOT
    VITE_API_ENDPOINT=${aws_apigatewayv2_stage.main.invoke_url}
    VITE_REGION=${var.region}
    VITE_USER_POOL_ID=${aws_cognito_user_pool.main.id}
    VITE_USER_POOL_CLIENT_ID=${aws_cognito_user_pool_client.web.id}
    VITE_IDENTITY_POOL_ID=${aws_cognito_identity_pool.main.id}
    VITE_S3_BUCKET=${aws_s3_bucket.main.bucket}
    VITE_IOT_ENDPOINT=${data.aws_iot_endpoint.current.endpoint_address}
  EOT
}
