import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

export async function saveTokenToEnv(
  platform: string,
  accessToken: string,
  refreshToken?: string
): Promise<boolean> {
  try {
    if (!['figma', 'framer'].includes(platform)) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    const envPath = path.resolve(process.cwd(), '.env');

    if (!fs.existsSync(envPath)) {
      console.error('.env file not found');
      return false;
    }

    const envContent = fs.readFileSync(envPath, 'utf-8');

    let updatedEnv = envContent;

    const accessTokenVar = `${platform.toUpperCase()}_ACCESS_TOKEN`;
    const refreshTokenVar = `${platform.toUpperCase()}_REFRESH_TOKEN`;
    const tokenTimestampVar = `${platform.toUpperCase()}_TOKEN_TIMESTAMP`;

    const accessTokenRegex = new RegExp(`^${accessTokenVar}=.*$`, 'm');
    if (accessTokenRegex.test(updatedEnv)) {
      updatedEnv = updatedEnv.replace(
        accessTokenRegex,
        `${accessTokenVar}=${accessToken}`
      );
    } else {
      updatedEnv += `\n${accessTokenVar}=${accessToken}`;
    }

    if (refreshToken) {
      const refreshTokenRegex = new RegExp(`^${refreshTokenVar}=.*$`, 'm');
      if (refreshTokenRegex.test(updatedEnv)) {
        updatedEnv = updatedEnv.replace(
          refreshTokenRegex,
          `${refreshTokenVar}=${refreshToken}`
        );
      } else {
        updatedEnv += `\n${refreshTokenVar}=${refreshToken}`;
      }
    }

    const timestamp = new Date().toISOString();
    const timestampRegex = new RegExp(`^${tokenTimestampVar}=.*$`, 'm');
    if (timestampRegex.test(updatedEnv)) {
      updatedEnv = updatedEnv.replace(
        timestampRegex,
        `${tokenTimestampVar}=${timestamp}`
      );
    } else {
      updatedEnv += `\n${tokenTimestampVar}=${timestamp}`;
    }

    fs.writeFileSync(envPath, updatedEnv, 'utf-8');

    console.log(`Saved ${platform} tokens to .env file`);
    return true;
  } catch (error) {
    console.error('Error saving token to .env:', error);
    return false;
  }
}