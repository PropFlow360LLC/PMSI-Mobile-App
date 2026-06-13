import axios from 'axios';

const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';

export async function handleDeleteDriveFile(req, res) {
  const auth = req.headers.authorization;
  if (!auth) {
    return res.status(401).json({ error: 'Authorization required' });
  }

  const { fileId } = req.params;
  if (!fileId) {
    return res.status(400).json({ error: 'fileId required' });
  }

  try {
    await axios.delete(`${GOOGLE_DRIVE_API}/files/${fileId}`, {
      headers: { Authorization: auth },
    });
    return res.json({ success: true });
  } catch (err) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.error?.message || err.message || 'Delete failed';
    return res.status(status).json({ error: message });
  }
}
