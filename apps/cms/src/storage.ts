import { access, mkdir } from 'node:fs/promises'
import path from 'node:path'

import type { S3ClientConfig } from '@aws-sdk/client-s3'
import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3'
import { s3Storage } from '@payloadcms/storage-s3'

/**
 * File storage. Any S3-compatible store when `S3_BUCKET` is set (RustFS in
 * development), otherwise a local folder, which is enough for tests.
 */
type S3Env = {
  bucket: string
  config: S3ClientConfig
}

function readS3Env(env = process.env): S3Env | null {
  const bucket = env.S3_BUCKET?.trim()
  if (!bucket) return null
  const endpoint = env.S3_ENDPOINT?.trim()
  const accessKeyId = env.S3_ACCESS_KEY_ID?.trim()
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY?.trim()
  return {
    bucket,
    config: {
      ...(endpoint ? { endpoint } : {}),
      region: env.S3_REGION?.trim() || 'us-east-1',
      forcePathStyle: env.S3_FORCE_PATH_STYLE
        ? env.S3_FORCE_PATH_STYLE === 'true'
        : Boolean(endpoint),
      // Without both keys, the AWS SDK falls back to its own credential chain,
      // such as an IAM role, instead of signing with empty keys.
      ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
    },
  }
}

export const localMediaDir = path.resolve(process.cwd(), process.env.PT_MEDIA_DIR ?? 'media')

/**
 * The S3 adapter is always registered, and switched off when no bucket is set.
 * Payload still adds its fields when it is off, so the database schema is the
 * same in every environment.
 */
export function storageAdapters() {
  const s3 = readS3Env()
  return [
    s3Storage({
      enabled: Boolean(s3),
      bucket: s3?.bucket ?? '',
      collections: { media: true },
      config: s3?.config ?? {},
    }),
  ]
}

export async function checkStorage(): Promise<{ kind: string }> {
  const s3 = readS3Env()
  if (s3) {
    const client = new S3Client(s3.config)
    try {
      await client.send(new HeadBucketCommand({ Bucket: s3.bucket }))
    } finally {
      // Close the client's sockets, or every health check leaves some open.
      client.destroy()
    }
    return { kind: 's3' }
  }
  await mkdir(localMediaDir, { recursive: true })
  await access(localMediaDir)
  return { kind: 'local' }
}
