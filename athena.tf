# ─── S3 (ATHENA QUERY RESULTS) ────────────────────────────────────────────────

resource "aws_s3_bucket" "athena_results" {
  bucket        = "${var.project_name}-${var.environment}-athena-${data.aws_caller_identity.current.account_id}"
  force_destroy = true
  tags          = local.tags
}

resource "aws_s3_bucket_public_access_block" "athena_results" {
  bucket                  = aws_s3_bucket.athena_results.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ─── KINESIS FIREHOSE (Kinesis Data Stream → S3 for Athena) ──────────────────
# Runs independently of the Lambda event source mapping — both consume the same
# Kinesis stream in parallel. Firehose lands raw Rekognition JSON in the main
# S3 bucket under rekognition-data/ for Athena to query.

resource "aws_kinesis_firehose_delivery_stream" "rekognition_to_s3" {
  name        = "${var.project_name}-${var.environment}-rekognition-to-s3"
  destination = "extended_s3"

  kinesis_source_configuration {
    kinesis_stream_arn = aws_kinesis_stream.rekognition_output.arn
    role_arn           = aws_iam_role.firehose.arn
  }

  extended_s3_configuration {
    role_arn   = aws_iam_role.firehose.arn
    bucket_arn = aws_s3_bucket.main.arn

    # Hive-style partitions so Athena can prune efficiently
    prefix              = "rekognition-data/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/hour=!{timestamp:HH}/"
    error_output_prefix = "rekognition-errors/!{firehose:error-output-type}/year=!{timestamp:yyyy}/month=!{timestamp:MM}/"

    buffering_size     = 5   # MB — flush when 5 MB accumulated
    buffering_interval = 60  # seconds — flush at least every minute
    compression_format = "GZIP"
  }

  tags = local.tags
}

# ─── GLUE (schema catalog for Athena) ────────────────────────────────────────

resource "aws_glue_catalog_database" "main" {
  name = "${replace(var.project_name, "-", "_")}_${var.environment}"
}

# Table over raw Rekognition stream-processor output (JSON lines, gzip compressed)
resource "aws_glue_catalog_table" "rekognition_data" {
  name          = "rekognition_data"
  database_name = aws_glue_catalog_database.main.name
  table_type    = "EXTERNAL_TABLE"

  parameters = {
    "classification"  = "json"
    "compressionType" = "gzip"
    "typeOfData"      = "file"
    "EXTERNAL"        = "TRUE"
  }

  storage_descriptor {
    location      = "s3://${aws_s3_bucket.main.bucket}/rekognition-data/"
    input_format  = "org.apache.hadoop.mapred.TextInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat"
    compressed    = true

    ser_de_info {
      serialization_library = "org.openx.data.jsonserde.JsonSerDe"
      parameters = {
        "ignore.malformed.json" = "true"
        "dots.in.keys"          = "false"
      }
    }

    # Rekognition Connected Home stream processor output fields
    columns {
      name = "locationid"
      type = "string"
    }
    columns {
      name = "timestamp"
      type = "string"
    }
    columns {
      name = "personcount"
      type = "int"
    }
    columns {
      name = "confidence"
      type = "double"
    }
    columns {
      name    = "labels"
      type    = "array<struct<Name:string,Confidence:double>>"
      comment = "Rekognition detected labels array"
    }
    columns {
      name    = "inputinformation"
      type    = "struct<kinesisVideo:struct<streamArn:string,fragmentNumber:string,serverTimestamp:double,producerTimestamp:double,frameOffsetInSeconds:double>>"
      comment = "Source KVS fragment metadata"
    }
  }

  # Hive-style partitions matching the Firehose prefix pattern
  partition_keys {
    name = "year"
    type = "string"
  }
  partition_keys {
    name = "month"
    type = "string"
  }
  partition_keys {
    name = "day"
    type = "string"
  }
  partition_keys {
    name = "hour"
    type = "string"
  }
}

# ─── ATHENA ───────────────────────────────────────────────────────────────────

resource "aws_athena_workgroup" "main" {
  name          = "${var.project_name}-${var.environment}"
  force_destroy = true

  configuration {
    enforce_workgroup_configuration    = true
    publish_cloudwatch_metrics_enabled = true

    result_configuration {
      output_location = "s3://${aws_s3_bucket.athena_results.bucket}/query-results/"

      encryption_configuration {
        encryption_option = "SSE_S3"
      }
    }
  }

  tags = local.tags
}
