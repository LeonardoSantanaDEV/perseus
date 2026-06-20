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
  private signer: S3Client;
  readonly packagesBucket: string;
  readonly artifactsBucket: string;

  constructor() {
    const internalEndpoint = process.env.S3_ENDPOINT || 'http://localhost:9000';
    const publicEndpoint = process.env.S3_PUBLIC_ENDPOINT || internalEndpoint;
    const region = process.env.S3_REGION || 'us-east-1';
    const forcePathStyle = (process.env.S3_FORCE_PATH_STYLE || 'true') === 'true';
    const credentials = {
      accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
      secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
    };

    // Cliente interno: upload/delete a partir da API (rede interna do Docker,
    // ex.: http://minio:9000).
    this.client = new S3Client({
      region,
      endpoint: internalEndpoint,
      forcePathStyle,
      credentials,
    });

    // Cliente público: presigna URLs de download com o host que o runner/browser
    // realmente acessam (ex.: http://localhost:9000). O host faz parte da
    // assinatura SigV4, então presignar já com o endpoint público mantém a
    // assinatura válida — reescrever o host depois a invalidaria.
    this.signer = new S3Client({
      region,
      endpoint: publicEndpoint,
      forcePathStyle,
      credentials,
    });

    this.packagesBucket = process.env.S3_BUCKET_PACKAGES || 'perseus-packages';
    this.artifactsBucket = process.env.S3_BUCKET_ARTIFACTS || 'perseus-artifacts';
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
    return getSignedUrl(
      this.signer,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn },
    );
  }

  async delete(bucket: string, key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: key }),
    );
  }
}
