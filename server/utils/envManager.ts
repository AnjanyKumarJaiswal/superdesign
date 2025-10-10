/**
 * Environment Variable Manager
 * Allows saving OAuth tokens to .env file
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

/**
 * Save an access token to the .env file
 * @param platform - The platform (figma, framer)
 * @param accessToken - The OAuth access token
 * @param refreshToken - Optional refresh token
 */
export async function saveTokenToEnv(
  platform: string, 
  accessToken: string, 
  refreshToken?: string
): Promise<boolean> {
  try {
    // Safety check: only allow known platforms
    if (!['figma', 'framer'].includes(platform)) {
      throw new Error(`Unsupported platform: ${platform}`);
    }
    
    // Get path to .env file (root directory)
    const envPath = path.resolve(process.cwd(), '.env');
    
    // Safety check: make sure .env file exists
    if (!fs.existsSync(envPath)) {
      console.error('.env file not found');
      return false;
    }
    
    // Read current .env file
    const envContent = fs.readFileSync(envPath, 'utf-8');
    
    // Create updated environment variables
    let updatedEnv = envContent;
    
    // Variable names based on platform
    const accessTokenVar = `${platform.toUpperCase()}_ACCESS_TOKEN`;
    const refreshTokenVar = `${platform.toUpperCase()}_REFRESH_TOKEN`;
    const tokenTimestampVar = `${platform.toUpperCase()}_TOKEN_TIMESTAMP`;
    
    // Update access token
    const accessTokenRegex = new RegExp(`^${accessTokenVar}=.*$`, 'm');
    if (accessTokenRegex.test(updatedEnv)) {
      // Replace existing value
      updatedEnv = updatedEnv.replace(
        accessTokenRegex, 
        `${accessTokenVar}=${accessToken}`
      );
    } else {
      // Add new value
      updatedEnv += `\n${accessTokenVar}=${accessToken}`;
    }
    
    // Update refresh token if provided
    if (refreshToken) {
      const refreshTokenRegex = new RegExp(`^${refreshTokenVar}=.*$`, 'm');
      if (refreshTokenRegex.test(updatedEnv)) {
        // Replace existing value
        updatedEnv = updatedEnv.replace(
          refreshTokenRegex, 
          `${refreshTokenVar}=${refreshToken}`
        );
      } else {
        // Add new value
        updatedEnv += `\n${refreshTokenVar}=${refreshToken}`;
      }
    }
    
    // Update timestamp
    const timestamp = new Date().toISOString();
    const timestampRegex = new RegExp(`^${tokenTimestampVar}=.*$`, 'm');
    if (timestampRegex.test(updatedEnv)) {
      // Replace existing value
      updatedEnv = updatedEnv.replace(
        timestampRegex, 
        `${tokenTimestampVar}=${timestamp}`
      );
    } else {
      // Add new value
      updatedEnv += `\n${tokenTimestampVar}=${timestamp}`;
    }
    
    // Write updated .env file
    fs.writeFileSync(envPath, updatedEnv, 'utf-8');
    
    console.log(`Saved ${platform} tokens to .env file`);
    return true;
  } catch (error) {
    console.error('Error saving token to .env:', error);
    return false;
  }
}