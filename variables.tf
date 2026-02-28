variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "goblin-counter"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "location_ids" {
  description = "List of location IDs to create KVS streams and Rekognition processors for"
  type        = list(string)
  default = [
    "library-entrance",
    "cafeteria-entrance",
    "gym-entrance",
    "study-room-a"
  ]
}

variable "github_repo" {
  description = "GitHub repository URL for Amplify CI/CD (e.g. https://github.com/org/repo). Leave empty to use manual deployments."
  type        = string
  default     = ""
}

variable "github_token" {
  description = "GitHub Personal Access Token (classic, repo scope) for Amplify CI/CD. Never commit this value — pass via TF_VAR or tfvars."
  type        = string
  sensitive   = true
  default     = ""
}

variable "bedrock_model_id" {
  description = "Amazon Bedrock model ID used by chat and analyzer lambdas"
  type        = string
  default     = "anthropic.claude-3-5-sonnet-20241022-v2:0"
}
