'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Card from '@/components/common/Card';
import styles from './page.module.css';
import { Album } from '@/types';

/**
 * 앨범 페이지
 */
export default function AlbumsPage() {
  const { data: session } = useSession();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [expandedImageIndex, setExpandedImageIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetchAlbums = async () => {
      try {
        const response = await fetch('/api/parent/albums');
        if (!response.ok) throw new Error('앨범을 불러올 수 없습니다.');
        const data = await response.json();
        setAlbums(data.data || []);
      } catch (error) {
        console.error('Albums fetch error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlbums();
  }, []);

  return (
    <div className={styles.container}>
      <h1>앨범</h1>

      {isLoading ? (
        <div className={styles.loading}>로딩 중...</div>
      ) : albums.length > 0 ? (
        <>
          <div className={styles.albumsList}>
            {albums.map((album) => (
              <Card
                key={album.id}
                variant="outlined"
                onClick={() => {
                  setSelectedAlbum(album);
                  setExpandedImageIndex(null);
                }}
              >
                <div className={styles.albumCard}>
                  {album.images.length > 0 && (
                    <div className={styles.albumThumbnail}>
                      <img
                        src={album.images[0].url}
                        alt={album.title}
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder.png';
                        }}
                      />
                      <span className={styles.imageCount}>
                        {album.images.length}장
                      </span>
                    </div>
                  )}
                  <h3>{album.title}</h3>
                  <p className={styles.description}>{album.description || '설명 없음'}</p>
                  <p className={styles.date}>
                    {new Date(album.eventDate).toLocaleDateString()}
                  </p>
                </div>
              </Card>
            ))}
          </div>

          {/* 앨범 상세 보기 모달 */}
          {selectedAlbum && (
            <div className={styles.modal} onClick={() => setSelectedAlbum(null)}>
              <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <button className={styles.closeBtn} onClick={() => setSelectedAlbum(null)}>
                  ✕
                </button>

                <h2>{selectedAlbum.title}</h2>
                <p className={styles.modalDate}>
                  {new Date(selectedAlbum.eventDate).toLocaleDateString()}
                </p>

                {selectedAlbum.description && (
                  <p className={styles.modalDescription}>{selectedAlbum.description}</p>
                )}

                <div className={styles.imageGallery}>
                  {selectedAlbum.images.map((image, index) => (
                    <div key={image.id} className={styles.galleryItem}>
                      <img
                        src={image.url}
                        alt={image.caption || `Image ${index + 1}`}
                        onClick={() =>
                          setExpandedImageIndex(expandedImageIndex === index ? null : index)
                        }
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder.png';
                        }}
                      />
                      {image.caption && (
                        <p className={styles.imageCaption}>{image.caption}</p>
                      )}
                    </div>
                  ))}
                </div>

                {expandedImageIndex !== null && (
                  <div
                    className={styles.imageModal}
                    onClick={() => setExpandedImageIndex(null)}
                  >
                    <img
                      src={selectedAlbum.images[expandedImageIndex].url}
                      alt="Expanded"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <Card>
          <p className={styles.emptyMessage}>앨범이 없습니다.</p>
        </Card>
      )}
    </div>
  );
}
