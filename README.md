# goblin-counter — Terraform Infrastructure

## Prerequisites

```bash
# Install Terraform
brew install terraform   # macOS
# or
sudo apt install terraform  # Linux

# Configure AWS credentials
aws configure
# Enter your Access Key, Secret Key, region: us-east-1
```

## Deploy

```bash
cd terraform/

# Initialize
terraform init

# Preview what will be created
terraform plan

# Deploy everything
terraform apply
# Type 'yes' when prompted
```

Deployment takes ~3-5 minutes.

## After Deploy — Critical Steps

### 1. Get Pi credentials
```bash
terraform output pi_device_access_key_id
terraform output -raw pi_device_secret_access_key
```
Run `aws configure` on the Pi with these values.

### 2. Get frontend env vars
```bash
terraform output frontend_env
```
Paste the output into your React app's `.env` file.

### 3. Get IoT Core certs for Pi MQTT
Go to AWS Console → IoT Core → Manage → Things → goblin-counter-camera-pi-01
→ Certificates → Create certificate → Download all 4 files

### 4. Enable Bedrock model access
AWS Console → Bedrock → Model access → Enable `Claude 3.5 Sonnet`
(Takes ~1 minute, required before Bedrock Lambdas will work)

### 5. Seed location data into DynamoDB
```bash
aws dynamodb put-item --table-name goblin-counter-dev-locations --item \
  '{"locationId":{"S":"library-entrance"},"name":{"S":"Library Entrance"},"description":{"S":"Main library entry point"}}'

aws dynamodb put-item --table-name goblin-counter-dev-locations --item \
  '{"locationId":{"S":"cafeteria-entrance"},"name":{"S":"Cafeteria"},"description":{"S":"Main cafeteria entrance"}}'

aws dynamodb put-item --table-name goblin-counter-dev-locations --item \
  '{"locationId":{"S":"gym-entrance"},"name":{"S":"Gym"},"description":{"S":"Recreation center entrance"}}'

aws dynamodb put-item --table-name goblin-counter-dev-locations --item \
  '{"locationId":{"S":"study-room-a"},"name":{"S":"Study Room A"},"description":{"S":"Quiet study area"}}'
```

## Teardown

```bash
terraform destroy
```

## Resources Created

| Resource | Count |
|---|---|
| S3 Bucket | 1 |
| Cognito User Pool + Client | 1 each |
| Cognito Identity Pool | 1 |
| DynamoDB Tables | 3 |
| IoT Thing + Policy | 1 each |
| IoT Rule | 1 |
| Kinesis Video Streams | 4 (one per location) |
| Kinesis Data Stream | 1 |
| Rekognition Stream Processors | 4 |
| Lambda Functions | 5 |
| API Gateway (HTTP) | 1 |
| IAM Roles | 4 |
| SNS Topic | 1 |
