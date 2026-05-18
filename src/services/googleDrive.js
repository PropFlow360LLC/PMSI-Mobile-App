import axios from 'axios';

const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
const ROOT_FOLDER = import.meta.env.VITE_GOOGLE_DRIVE_ROOT_FOLDER || 'PMSI';
const PMSI_FOLDER_ID = import.meta.env.VITE_GOOGLE_DRIVE_PMSI_FOLDER_ID || '';

function driveHeaders(accessToken) {
  return { Authorization: `Bearer ${accessToken}` };
}

function escapeDriveQuery(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function normalizeKey(value) {
  return (value || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildPropertyFolderName(address, unit) {
  const name = address.trim();
  if (unit?.trim()) return `${name} - Unit ${unit.trim()}`;
  return name;
}

export function buildCoFolderName(coNumber) {
  return `CO#${String(coNumber).trim()}`;
}

export function parsePropertyFolderName(folderName) {
  const coLegacy = folderName.match(/^(.+?)\s-\sCO#(.+?)(?:\s-\sUnit\s+(.+))?$/i);
  if (coLegacy) {
    return {
      address: coLegacy[1].trim(),
      unit: (coLegacy[3] || '').trim(),
      legacyFlatCo: coLegacy[2].trim(),
    };
  }

  const unitMatch = folderName.match(/^(.+?)\s-\sUnit\s+(.+)$/i);
  if (unitMatch) {
    return { address: unitMatch[1].trim(), unit: unitMatch[2].trim(), legacyFlatCo: null };
  }

  return { address: folderName.trim(), unit: '', legacyFlatCo: null };
}

async function findPmsiFolderId(accessToken) {
  if (PMSI_FOLDER_ID) {
    try {
      const res = await axios.get(`${GOOGLE_DRIVE_API}/files/${PMSI_FOLDER_ID}`, {
        params: { fields: 'id,name,mimeType,trashed' },
        headers: driveHeaders(accessToken),
      });
      const folder = res.data;
      if (folder && !folder.trashed && folder.mimeType === 'application/vnd.google-apps.folder') {
        return folder.id;
      }
    } catch (err) {
      console.warn('Configured PMSI folder ID not accessible, falling back to name search:', err.message);
    }
  }

  const pmsiRes = await axios.get(`${GOOGLE_DRIVE_API}/files`, {
    params: {
      q: `name='${escapeDriveQuery(ROOT_FOLDER)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)',
      pageSize: 1,
    },
    headers: driveHeaders(accessToken),
  });
  return pmsiRes.data.files?.[0]?.id || null;
}

async function findCustomerFolderId(accessToken, customerName) {
  const pmsiId = await findPmsiFolderId(accessToken);
  if (!pmsiId) return null;

  const custRes = await axios.get(`${GOOGLE_DRIVE_API}/files`, {
    params: {
      q: `name='${escapeDriveQuery(customerName)}' and '${pmsiId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)',
      pageSize: 1,
    },
    headers: driveHeaders(accessToken),
  });
  return custRes.data.files?.[0] || null;
}

async function listChildFolders(accessToken, parentId) {
  const res = await axios.get(`${GOOGLE_DRIVE_API}/files`, {
    params: {
      q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)',
      orderBy: 'name',
      pageSize: 200,
    },
    headers: driveHeaders(accessToken),
  });
  return res.data.files || [];
}

function propertyFoldersMatch(folderName, address, unit) {
  const parsed = parsePropertyFolderName(folderName);
  if (parsed.legacyFlatCo) return false;
  return (
    normalizeKey(parsed.address) === normalizeKey(address) &&
    normalizeKey(parsed.unit) === normalizeKey(unit)
  );
}

export async function checkDuplicateAddress(accessToken, customerName, address, unit) {
  const empty = { duplicate: false, folderId: null, folderName: null, propertyFolderId: null };

  try {
    const customerFolder = await findCustomerFolderId(accessToken, customerName);
    if (!customerFolder) return empty;

    const folders = await listChildFolders(accessToken, customerFolder.id);
    const match = folders.find((f) => propertyFoldersMatch(f.name, address, unit));

    if (!match) return empty;

    return {
      duplicate: true,
      folderId: match.id,
      folderName: match.name,
      propertyFolderId: match.id,
    };
  } catch (err) {
    console.error('Duplicate check error:', err);
    return empty;
  }
}

async function findOrCreateFolder(accessToken, parentId, name) {
  const res = await axios.get(`${GOOGLE_DRIVE_API}/files`, {
    params: {
      q: `name='${escapeDriveQuery(name)}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)',
      pageSize: 1,
    },
    headers: driveHeaders(accessToken),
  });

  if (res.data.files?.length) {
    return res.data.files[0];
  }

  const createRes = await axios.post(
    `${GOOGLE_DRIVE_API}/files`,
    {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    { headers: driveHeaders(accessToken) }
  );

  return { id: createRes.data.id, name };
}

export async function resolveUploadFolder(
  accessToken,
  customerName,
  address,
  unit,
  coNumber
) {
  const customerFolder = await findCustomerFolderId(accessToken, customerName);
  if (!customerFolder) throw new Error('Customer folder not found');

  const match = await checkDuplicateAddress(accessToken, customerName, address, unit);
  let propertyFolderId;
  let propertyFolderName;

  if (match.duplicate) {
    propertyFolderId = match.propertyFolderId;
    propertyFolderName = match.folderName;
  } else {
    const propertyName = buildPropertyFolderName(address, unit);
    const created = await findOrCreateFolder(accessToken, customerFolder.id, propertyName);
    propertyFolderId = created.id;
    propertyFolderName = created.name;
  }

  if (coNumber?.trim()) {
    const coName = buildCoFolderName(coNumber);
    const coFolder = await findOrCreateFolder(accessToken, propertyFolderId, coName);
    return {
      folderId: coFolder.id,
      folderName: `${propertyFolderName} / ${coFolder.name}`,
      propertyFolderId,
      isChangeOrder: true,
    };
  }

  return {
    folderId: propertyFolderId,
    folderName: propertyFolderName,
    propertyFolderId,
    isChangeOrder: false,
  };
}

export async function loadCustomersFromDrive(accessToken) {
  try {
    const pmsiId = await findPmsiFolderId(accessToken);
    if (!pmsiId) return [];

    const custRes = await axios.get(`${GOOGLE_DRIVE_API}/files`, {
      params: {
        q: `'${pmsiId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id,name)',
        orderBy: 'name',
        pageSize: 100,
      },
      headers: driveHeaders(accessToken),
    });

    return custRes.data.files || [];
  } catch (err) {
    console.error('Load customers error:', err);
    return [];
  }
}

export async function extractAddressFromFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await axios.post('/api/extract-address', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return {
    address: res.data.address || null,
    unit: res.data.unit || null,
  };
}

export async function uploadPhotoToFolder(accessToken, folderId, photo) {
  const formData = new FormData();
  formData.append(
    'metadata',
    new Blob([JSON.stringify({ name: photo.name, parents: [folderId] })], {
      type: 'application/json',
    })
  );
  formData.append('file', photo);

  await axios.post(`${UPLOAD_API}?uploadType=multipart&fields=id`, formData, {
    headers: driveHeaders(accessToken),
  });
}

export async function uploadPhotosToDrive(
  accessToken,
  customer,
  address,
  unit,
  coNumber,
  photos
) {
  const { folderId } = await resolveUploadFolder(
    accessToken,
    customer,
    address,
    unit,
    coNumber
  );

  for (const photo of photos) {
    await uploadPhotoToFolder(accessToken, folderId, photo);
  }

  return true;
}
