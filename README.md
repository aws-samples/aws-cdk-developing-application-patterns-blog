# Repository for blog

This project relates to our blog post: [Developing enterprise application patterns with the AWS CDK](https://aws.amazon.com/blogs/devops/developing-application-patterns-cdk/)

##### https://docs.aws.amazon.com/codeartifact/latest/ug/getting-started-cli.html

For running the following commands, ensure that you have configured your profile and credentials to authenticate to your AWS account.

## Setting up CodeArtifact repository for publishing packages.

- Deploy CodeArtifact CloudFormation stack
  ```
  cd prerequisites
  rm -rf package-lock.json node_modules
  npm install
  cdk deploy --require-approval never
  cd ../
  ```

- Authenticate with npm
  ```
  aws codeartifact login \
      --tool npm \
      --domain blog-domain \
      --domain-owner $(aws sts get-caller-identity --output text --query 'Account') \
      --repository blog-repository
  ```

## Publishing packages to CodeArtifact repository

Follow the below mentioned steps to publish packages to CodeArtifact repository.

- Cleanup workspace (Remove files for fresh packaging and publish)
  ```
  rm -rf package-lock.json node_modules
  ```

- Install npm packages
  ```
  npm install
  ```

- Build the project
  ```
  npm run build
  ```

- Publish package to CodeArtifact repository
  ```
  npm publish
  ```

## Cleanup

These are the steps to cleanup all the resources that were created.

- Delete CloudFormation stack that deployed CodeArtifact resources
  ```
  cdk destroy --force
  ```
