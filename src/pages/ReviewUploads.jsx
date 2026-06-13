const STATUS_LABEL = {
  queued: 'Queued',
  uploading: 'Uploading',
  completed: 'Completed',
  failed: 'Failed',
};

const STATUS_COLOR = {
  queued: '#fbbf24',
  uploading: '#60a5fa',
  completed: '#00FF00',
  failed: '#e53e3e',
};

function UploadItem({ item, onRetry }) {
  const isVideo = item.mimeType?.startsWith('video/');
  const isImage = item.mimeType?.startsWith('image/');

  return (
    <div className="review-upload-item">
      <div className="review-upload-thumb">
        {item.previewUrl && isImage && (
          <img src={item.previewUrl} alt="" />
        )}
        {item.previewUrl && isVideo && (
          <video src={item.previewUrl} muted playsInline />
        )}
        {!item.previewUrl && (
          <div className="review-upload-thumb-placeholder">
            {isVideo ? '🎬' : '📄'}
          </div>
        )}
        <span
          className="review-upload-status-dot"
          style={{ background: STATUS_COLOR[item.status] || '#555' }}
        />
      </div>
      <div className="review-upload-info">
        <div className="review-upload-name">{item.fileName}</div>
        <div className="review-upload-meta" style={{ color: STATUS_COLOR[item.status] }}>
          {STATUS_LABEL[item.status] || item.status}
          {item.error && item.status === 'failed' && (
            <span className="review-upload-error"> — {item.error}</span>
          )}
        </div>
      </div>
      {item.status === 'failed' && item.queueId && (
        <button type="button" className="review-retry-btn" onClick={() => onRetry(item.queueId)}>
          Retry
        </button>
      )}
    </div>
  );
}

function Section({ title, items, onRetry }) {
  if (!items.length) return null;
  return (
    <div className="review-section">
      <h2 className="review-section-title">{title} ({items.length})</h2>
      <div className="review-section-list">
        {items.map((item) => (
          <UploadItem key={item.id} item={item} onRetry={onRetry} />
        ))}
      </div>
    </div>
  );
}

export default function ReviewUploads({ uploadItems, onBack, onRetry }) {
  const uploading = uploadItems.filter((i) => i.status === 'uploading');
  const queued = uploadItems.filter((i) => i.status === 'queued');
  const completed = uploadItems.filter((i) => i.status === 'completed');
  const failed = uploadItems.filter((i) => i.status === 'failed');
  const total = uploadItems.length;

  return (
    <div className="review-screen">
      <div className="review-header">
        <button type="button" className="review-back-btn" onClick={onBack} aria-label="Back">
          ‹
        </button>
        <div className="review-header-title">
          <div className="review-title">Review Uploads</div>
          <div className="review-subtitle">
            {total === 0
              ? 'No uploads yet'
              : `${uploading.length} uploading · ${queued.length} queued · ${completed.length} done`}
          </div>
        </div>
      </div>

      <div className="review-body">
        {total === 0 ? (
          <div className="review-empty">
            <div className="review-empty-icon">☁️</div>
            <p>Photos and videos you capture or select will appear here with their upload status.</p>
          </div>
        ) : (
          <>
            <Section title="Uploading" items={uploading} onRetry={onRetry} />
            <Section title="Queued" items={queued} onRetry={onRetry} />
            <Section title="Completed" items={completed} onRetry={onRetry} />
            <Section title="Failed" items={failed} onRetry={onRetry} />
          </>
        )}
      </div>
    </div>
  );
}
