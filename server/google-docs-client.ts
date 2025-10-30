import { google } from 'googleapis';
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

export async function getGoogleDocsClient(userId: string) {
  // Fetch user's OAuth tokens from database
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new Error('User not found');
  }

  const oAuth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET
  );

  oAuth2Client.setCredentials({
    access_token: user.accessToken,
    refresh_token: user.refreshToken,
  });

  // Automatically refresh and update tokens when expired
  oAuth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      try {
        const updateData: { accessToken: string; refreshToken?: string; updatedAt: Date } = {
          accessToken: tokens.access_token,
          updatedAt: new Date(),
        };
        
        // Only update refresh token if Google explicitly provides a new one
        // This prevents overwriting rotated tokens with stale values from concurrent clients
        if (tokens.refresh_token) {
          updateData.refreshToken = tokens.refresh_token;
        }
        
        await db
          .update(users)
          .set(updateData)
          .where(eq(users.id, userId));
      } catch (error) {
        console.error('Failed to update user tokens:', error);
      }
    }
  });

  return google.docs({
    version: 'v1',
    auth: oAuth2Client,
  });
}
