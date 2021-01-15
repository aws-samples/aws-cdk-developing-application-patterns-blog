# CDK Construct for Traditional apps.

This construct generates a CloudFormation template with the following AWS Resources
* Application Load Balancer
  - Target Groups
  - Listener and Listener rules
* Autoscaling Group
* Launch Configuration for EC2 instances
* RDS DB instance
* Secret in Secrets manager to store RDS DB credentials
* IAM Role for EC2 instance to access Secrets Manager
* Security group for EC2 instance and RDS DB instance
