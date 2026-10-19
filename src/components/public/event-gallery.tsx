"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import { EventImage } from "@/components/public/event-image";

type Photo = { id: string; variants: unknown; alt: string };

export function EventGallery({ photos }: { photos: Photo[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const touchStart = useRef<number | null>(null);
  const layout =
    photos.length === 1 ? "single" : photos.length === 2 ? "pair" : "mosaic";
  const activePhoto = activeIndex === null ? null : photos[activeIndex];

  useEffect(() => {
    if (activeIndex !== null && dialog.current && !dialog.current.open)
      dialog.current.showModal();
  }, [activeIndex]);

  function movePhoto(direction: number) {
    setActiveIndex((index) =>
      index === null
        ? null
        : (index + direction + photos.length) % photos.length,
    );
  }

  return (
    <section
      className="r-event-gallery mt-12"
      id="gallery"
      aria-labelledby="gallery-title"
    >
      <div className="r-event-gallery-heading">
        <h2 id="gallery-title">A look inside</h2>
        <span>
          {photos.length} {photos.length === 1 ? "photo" : "photos"}
        </span>
      </div>
      <div className="r-event-gallery-grid" data-layout={layout}>
        {photos.slice(0, 3).map((photo, index) => (
          <button
            className="r-event-gallery-item"
            key={photo.id}
            type="button"
            aria-label={
              photos.length > 3 && index === 2
                ? `View all ${photos.length} photos`
                : `View photo ${index + 1} of ${photos.length}: ${photo.alt}`
            }
            onClick={(event) => {
              opener.current = event.currentTarget;
              setActiveIndex(photos.length > 3 && index === 2 ? 0 : index);
            }}
          >
            <EventImage
              variants={photo.variants}
              alt=""
              size="card"
              className="r-event-gallery-image"
            />
            {photos.length > 3 && index === 2 && (
              <span className="r-event-gallery-more">
                <Images size={17} aria-hidden="true" />
                View all {photos.length} photos
              </span>
            )}
          </button>
        ))}
      </div>

      <dialog
        className="r-event-gallery-dialog"
        ref={dialog}
        aria-label="Event photo viewer"
        onClose={() => {
          setActiveIndex(null);
          requestAnimationFrame(() => opener.current?.focus());
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            movePhoto(-1);
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            movePhoto(1);
          }
        }}
      >
        {activePhoto && activeIndex !== null && (
          <div className="r-event-gallery-viewer">
            <header className="r-event-gallery-viewer-header">
              <p aria-live="polite">
                {activeIndex + 1} <span>/</span> {photos.length}
              </p>
              <button
                type="button"
                className="r-event-gallery-viewer-close"
                aria-label="Close photo viewer"
                onClick={() => dialog.current?.close()}
              >
                <X size={22} aria-hidden="true" />
              </button>
            </header>
            <div
              className="r-event-gallery-viewer-stage"
              data-multiple={photos.length > 1}
              onTouchStart={(event) => {
                touchStart.current = event.changedTouches[0]?.clientX ?? null;
              }}
              onTouchEnd={(event) => {
                const start = touchStart.current;
                const end = event.changedTouches[0]?.clientX;
                touchStart.current = null;
                if (
                  start !== null &&
                  end !== undefined &&
                  Math.abs(end - start) > 48
                )
                  movePhoto(end < start ? 1 : -1);
              }}
            >
              {photos.length > 1 && (
                <button
                  type="button"
                  className="r-event-gallery-viewer-nav"
                  aria-label="Previous photo"
                  onClick={() => movePhoto(-1)}
                >
                  <ChevronLeft size={24} aria-hidden="true" />
                </button>
              )}
              <EventImage
                key={activePhoto.id}
                variants={activePhoto.variants}
                alt={activePhoto.alt}
                size="hero"
                className="r-event-gallery-viewer-image"
              />
              {photos.length > 1 && (
                <button
                  type="button"
                  className="r-event-gallery-viewer-nav"
                  aria-label="Next photo"
                  onClick={() => movePhoto(1)}
                >
                  <ChevronRight size={24} aria-hidden="true" />
                </button>
              )}
            </div>
            <footer className="r-event-gallery-viewer-footer">
              <p>{activePhoto.alt}</p>
            </footer>
          </div>
        )}
      </dialog>
    </section>
  );
}
