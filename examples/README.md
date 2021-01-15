## Deploy example stack to AWS

Below mentioned steps can be followed to deploy any of the example stacks.

> The below mentioned steps are for deploying serverless app to an AWS account. Before running the `cdk deploy` command, ensure that you have configured your profile and credentials to authenticate to your AWS account.

- Go to the corresponding directory.
  ```
  cd serverless/
  ```

- Cleanup workspace and Install npm packages
  ```
  rm -rf package-lock.json node_modules ; npm install
  ```

> **This step is applicable for overriding serverless example only: Additional step for overriding serverless pattern example**
- Build the project
  ```
  npm run build
  ```

> **This step is applicable for serverless examples only: cdk bootstrap is used when stacks contain assets or Lambda functions source code**
- Bootstrap the project (create staging S3 bucket)
  ```
  cdk bootstrap
  ```

- Deploy CloudFormation stack: The `require-approval` parameter is used when security-sensitive changes need manual approval.
  ```
  cdk deploy --require-approval never
  ```


## Cleanup

To delete the stack, following command can be used. The `--force` option is used for not waiting for user input before deleting stack.
```
cdk destroy --force
```
