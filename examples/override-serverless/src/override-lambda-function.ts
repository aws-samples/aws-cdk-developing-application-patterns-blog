const AWS = require('aws-sdk');
const db = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || '';
const PARTITION_KEY = process.env.PARTITION_KEY || '';

export const lambda_handler = async () : Promise <any> => {
    const params = {
        TableName: TABLE_NAME,
        Item: {
            [PARTITION_KEY]: Math.floor(Date.now()).toString(),
            app: 'override-serverless',
            purpose: 'blog',
            description: 'adding a 4th attribute to differentiate'
        }
    }

    try {
        await db.put(params).promise();
        console.log('Added item to DynamoDB')
        const response = await db.scan(params).promise();
        return { statusCode: 200, body: JSON.stringify(response.Items) }
    } catch (dbError) {
        return { statusCode: 500, body: JSON.stringify(dbError) }
    }
}