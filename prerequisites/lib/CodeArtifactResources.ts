import * as core from '@aws-cdk/core'
import * as codeartifact from '@aws-cdk/aws-codeartifact'


export class CodeArtifactResources extends core.Stack {
    constructor(scope: core.App, id: string) {
        super(scope, id)

        const domain = new codeartifact.CfnDomain(this, 'CodeArtifactDomain', {
            domainName: 'blog-domain'
        })
        const blogNpmRepo = new codeartifact.CfnRepository(this, 'BlogNPMRepository', {
            repositoryName: 'blog-npm-store',
            domainName: domain.domainName,
            externalConnections: [
                'public:npmjs'
            ]
        })
        blogNpmRepo.addDependsOn(domain)

        const blogRepo = new codeartifact.CfnRepository(this, 'BlogRepo', {
            repositoryName: 'blog-repository',
            domainName: domain.domainName,
            upstreams: [
                blogNpmRepo.repositoryName
            ]
        })
        blogRepo.addDependsOn(blogNpmRepo)
    }
}
const app = new core.App()
new CodeArtifactResources(app, 'CodeArtifactResources')
