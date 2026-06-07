import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private client: S3Client;
  readonly packagesBucket: string;
  readonly artifactsBucket: string;
  private readonly publicEndpoint: string;

  constructor() {
    this.client = new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
      forcePathStyle: (process.env.S3_FORCE_PATH_STYLE || 'true') === 'true',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
        secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
      },
    });
    this.packagesBucket = process.env.S3_BUCKET_PACKAGES || 'bot-packages';
    this.artifactsBucket = process.env.S3_BUCKET_ARTIFACTS || 'bot-artifacts';
    this.publicEndpoint =
      process.env.S3_PUBLIC_ENDPOINT ||
      process.env.S3_ENDPOINT ||
      'http://localhost:9000';
  }

  async upload(
    bucket: string,
    key: string,
    body: Buffer,
    contentType?: string,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async getDownloadUrl(
    bucket: string,
    key: string,
    expiresIn = 3600,
  ): Promise<string> {
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn },
    );
    return this.rewriteHost(url);
  }

  async delete(bucket: string, key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: key }),
    );
  }

  // Garante que a URL assinada use o endpoint público (acessível pelo runner)
  private rewriteHost(url: string): string {
    const internal = process.env.S3_ENDPOINT || 'http://localhost:9000';
    if (this.publicEndpoint && url.startsWith(internal)) {
      return this.publicEndpoint + url.slice(internal.length);
    }
    return url;
  }
}
