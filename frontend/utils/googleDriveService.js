export const googleDriveService = {
  // Exchange code for tokens
  async exchangeCodeForTokens(code, redirectUri, clientId, clientSecret = '', codeVerifier = '') {
    const params = {
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    };
    if (clientSecret) {
      params.client_secret = clientSecret;
    }
    if (codeVerifier) {
      params.code_verifier = codeVerifier;
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Token exchange failed: ${errText}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    };
  },

  // Refresh active token
  async refreshAccessToken(refreshToken, clientId, clientSecret = '') {
    const params = {
      refresh_token: refreshToken,
      client_id: clientId,
      grant_type: 'refresh_token',
    };
    if (clientSecret) {
      params.client_secret = clientSecret;
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params),
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    };
  },

  // Get active token (refresh if expired)
  async getValidToken(tokens, clientId, clientSecret = '') {
    if (!tokens) {
      throw new Error('No tokens available');
    }

    if (tokens.accessToken && tokens.expiresAt && Date.now() < tokens.expiresAt - 60000) {
      return tokens.accessToken;
    }

    if (!tokens.refreshToken) {
      throw new Error('Session expired. Please reconnect your Google Drive account.');
    }

    const refreshed = await this.refreshAccessToken(tokens.refreshToken, clientId, clientSecret);
    tokens.accessToken = refreshed.accessToken;
    tokens.expiresAt = refreshed.expiresAt;
    localStorage.setItem('gdrive_tokens', JSON.stringify(tokens));
    return refreshed.accessToken;
  },

  // Upload/Update file in Google Drive
  async uploadSyncFile(tokens, clientId, content, clientSecret = '') {
    const accessToken = await this.getValidToken(tokens, clientId, clientSecret);
    
    // 1. Search for existing yoru_reader_sync.json file
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='yoru_reader_sync.json' and trashed=false&fields=files(id)`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    let fileId = null;
    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        fileId = data.files[0].id;
      }
    }

    const fileMetadata = {
      name: 'yoru_reader_sync.json',
      mimeType: 'application/json',
    };

    const boundary = 'foo_bar_boundary';
    
    let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    let method = 'POST';

    if (fileId) {
      url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
      method = 'PATCH';
    }

    const body = 
      `\r\n--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(fileMetadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${JSON.stringify(content, null, 2)}\r\n` +
      `--${boundary}--`;

    const uploadRes = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Upload failed: ${errText}`);
    }

    return await uploadRes.json();
  },

  // Download sync file from Google Drive
  async downloadSyncFile(tokens, clientId, clientSecret = '') {
    const accessToken = await this.getValidToken(tokens, clientId, clientSecret);

    // 1. Search for yoru_reader_sync.json file
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='yoru_reader_sync.json' and trashed=false&fields=files(id)`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!searchRes.ok) {
      throw new Error('Failed to search sync file in Google Drive');
    }

    const data = await searchRes.json();
    if (!data.files || data.files.length === 0) {
      return null;
    }

    const fileId = data.files[0].id;

    // 2. Download file content
    const downloadRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!downloadRes.ok) {
      throw new Error('Failed to download sync file content');
    }

    return await downloadRes.json();
  },

  // Get connected user information (email & display name)
  async getUserInfo(tokens, clientId, clientSecret = '') {
    const accessToken = await this.getValidToken(tokens, clientId, clientSecret);
    const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      // Fallback: try oauth2 userinfo endpoint in case Drive about fails
      const fallbackRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (fallbackRes.ok) {
        const userInfo = await fallbackRes.json();
        return {
          email: userInfo.email || userInfo.sub,
          displayName: userInfo.name || userInfo.email
        };
      }
      throw new Error('Failed to retrieve user info');
    }

    const data = await response.json();
    return {
      email: data.user ? data.user.emailAddress : '',
      displayName: data.user ? data.user.displayName : ''
    };
  },

  // Upload a binary Blob (e.g. ZIP) to Google Drive
  async uploadBlobFile(tokens, clientId, blob, fileName, mimeType, clientSecret = '') {
    const accessToken = await this.getValidToken(tokens, clientId, clientSecret);

    // 1. Search for existing file with the same name
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and trashed=false&fields=files(id)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    let fileId = null;
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        fileId = searchData.files[0].id;
      }
    }

    // 2. Build multipart body
    const boundary = 'yoru_backup_boundary';
    const metadataStr = JSON.stringify({ name: fileName, mimeType });

    // Convert blob to ArrayBuffer, then combine with metadata in multipart form
    const blobBuffer = await blob.arrayBuffer();
    const encoder = new TextEncoder();

    const preamble = encoder.encode(
      `\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${metadataStr}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
    );
    const epilogue = encoder.encode(`\r\n--${boundary}--`);

    const combined = new Uint8Array(preamble.byteLength + blobBuffer.byteLength + epilogue.byteLength);
    combined.set(preamble, 0);
    combined.set(new Uint8Array(blobBuffer), preamble.byteLength);
    combined.set(epilogue, preamble.byteLength + blobBuffer.byteLength);

    // 3. Upload
    const uploadUrl = fileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
      : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
    const uploadMethod = fileId ? 'PATCH' : 'POST';

    const uploadRes = await fetch(uploadUrl, {
      method: uploadMethod,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: combined,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Blob upload failed: ${errText}`);
    }

    return await uploadRes.json();
  },

  // Download a binary file (e.g. ZIP) from Google Drive by name
  async downloadBlobFile(tokens, clientId, fileName, clientSecret = '') {
    const accessToken = await this.getValidToken(tokens, clientId, clientSecret);

    // Search for the file by name
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and trashed=false&fields=files(id,name,modifiedTime)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!searchRes.ok) throw new Error('Failed to search file in Google Drive');

    const searchData = await searchRes.json();
    if (!searchData.files || searchData.files.length === 0) return null;

    const fileId = searchData.files[0].id;

    const downloadRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!downloadRes.ok) throw new Error('Failed to download file from Google Drive');

    return await downloadRes.blob();
  }
};

