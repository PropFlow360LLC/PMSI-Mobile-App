import axios from 'axios';

const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
const OPENAI_API = 'https://api.openai.com/v1/chat/completions';
const ROOT_FOLDER = import.meta.env.VITE_GOOGLE_DRIVE_ROOT_FOLDER || 'PMSI';

// Load list of customer folders from PMSI root
export async function loadCustomersFromDrive(token) {
  try {
    // First find PMSI folder
    const pmsiRes = await axios.get(`${GOOGLE_DRIVE_API}/files`, {
      params: {
        q: `name='${ROOT_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id,name)',
        pageSize: 1
      },
      headers: { Authorization: `Bearer ${token}` }
    });

    const pmsiFolder = pmsiRes.data.files?.[0];
    if (!pmsiFolder) return [];

    // Get all customer folders inside PMSI
    const custRes = await axios.get(`${GOOGLE_DRIVE_API}/files`, {
      params: {
        q: `'${pmsiFolder.id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id,name)',
        orderBy: 'name',
        pageSize: 100
      },
      headers: { Authorization: `Bearer ${token}` }
    });

    return custRes.data.files || [];
  } catch (err) {
    console.error('Load customers error:', err);
    return [];
  }
}

// Check if address folder exists under customer
export async function checkDuplicateAddress(customer, address) {
  // This will be called after getting token from gAuth
  // For now, return false
  return false;
}

// Extract address from uploaded file using OpenAI Vision
export async function extractAddressFromFile(file) {
  try {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onload = async () => {
        const base64 = reader.result.split(',')[1];
        const isImage = file.type.startsWith('image/');
        const mimeType = isImage ? file.type : 'image/jpeg';

        try {
          const res = await axios.post(OPENAI_API, {
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'Extract the property address from this document. Return ONLY the house number and street name (e.g., "123 Main St"). No city, state, or zip. If you cannot find an address, return "NOT_FOUND".'
                  },
                  {
                    type: 'image_url',
                    image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'low' }
                  }
                ]
              }
            ],
            max_tokens: 50
          }, {
            headers: { Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}` }
          });

          const text = res.data.choices?.[0]?.message?.content?.trim() || '';
          if (text === 'NOT_FOUND' || !text) {
            resolve(null);
          } else {
            resolve(text);
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsDataURL(file);
    });
  } catch (err) {
    console.error('Extract address error:', err);
    throw err;
  }
}

// Upload photos to Google Drive
export async function uploadPhotosToDrive(token, customer, address, unit, coDuplicateChoice, coNumber, photos) {
  try {
    // Build folder name
    let folderName = address;
    if (coNumber) folderName += ` - CO#${coNumber}`;
    if (unit) folderName += ` - Unit ${unit}`;

    // Find PMSI folder
    const pmsiRes = await axios.get(`${GOOGLE_DRIVE_API}/files`, {
      params: {
        q: `name='${ROOT_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id)',
        pageSize: 1
      },
      headers: { Authorization: `Bearer ${token}` }
    });

    const pmsiId = pmsiRes.data.files?.[0]?.id;
    if (!pmsiId) throw new Error('PMSI folder not found');

    // Find or verify customer folder
    const custRes = await axios.get(`${GOOGLE_DRIVE_API}/files`, {
      params: {
        q: `name='${customer}' and '${pmsiId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id)',
        pageSize: 1
      },
      headers: { Authorization: `Bearer ${token}` }
    });

    const custId = custRes.data.files?.[0]?.id;
    if (!custId) throw new Error('Customer folder not found');

    // Find or create address folder
    let addressFolderId;
    const addrRes = await axios.get(`${GOOGLE_DRIVE_API}/files`, {
      params: {
        q: `name='${folderName}' and '${custId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id)',
        pageSize: 1
      },
      headers: { Authorization: `Bearer ${token}` }
    });

    if (addrRes.data.files?.length) {
      addressFolderId = addrRes.data.files[0].id;
    } else {
      // Create new folder
      const createRes = await axios.post(`${GOOGLE_DRIVE_API}/files`, {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [custId]
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      addressFolderId = createRes.data.id;
    }

    // Upload all photos
    for (const photo of photos) {
      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify({ name: photo.name, parents: [addressFolderId] })], { type: 'application/json' }));
      formData.append('file', photo);

      await axios.post(`${GOOGLE_DRIVE_API}/files?uploadType=multipart&fields=id`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
    }

    return true;
  } catch (err) {
    console.error('Upload error:', err);
    throw err;
  }
}
