## Deploy CodeArtifact resources

This CDK project deploys the following CodeArtifact resources:
- CodeArtifact domain named blog-domain.
- CodeArtifact repository named blog-npm-store.
  - This repository serves as an upstream repository.
  - This has an external connection to public NPM repository.
  - Details about upstream repositories can be found in [AWS CodeArtifact Developer guide](https://docs.aws.amazon.com/codeartifact/latest/ug/repos-upstream.html).
- CodeArtifact repository named blog-repository.

## Deployment steps

Deploy CloudFormation stack: The `require-approval` parameter is used when security-sensitive changes need manual approval.

```
cdk deploy --require-approval never
```

Once stack deployment is complete, authenticate with npm

```
aws codeartifact login \
    --tool npm \
    --domain blog-domain \
    --domain-owner $(aws sts get-caller-identity --output text --query 'Account') \
    --repository blog-repository
```


## Cleanup

To delete the stack, following command can be used. The `--force` option is used for not waiting for user input before deleting stack.
```
cdk destroy --force
```

Remove npm configuration file that was created

```
echo "" > ~/.npmrc
```
