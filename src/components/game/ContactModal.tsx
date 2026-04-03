"use client";

import type { Contact } from "@/lib/game/contact-info";

interface ContactModalProps {
  contact: Contact;
  defaultContactInfo: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ContactModal({
  contact,
  defaultContactInfo,
  isOpen,
  onClose,
}: ContactModalProps) {
  if (!isOpen) return null;

  const entries = Object.entries(contact);

  return (
    <div id="contactOverlay" style={{ display: "flex" }} onClick={onClose}>
      <div id="contactContent" onClick={(e) => e.stopPropagation()}>
        <button id="closeBtn" onClick={onClose}>
          X
        </button>
        <div id="contactLinks">
          <h2 style={{ textAlign: "center" }}>Artist</h2>
          {entries.length === 0 ? (
            <div style={{ textAlign: "center" }}>
              <a href={defaultContactInfo} target="_blank" rel="noreferrer">
                {defaultContactInfo}
              </a>
            </div>
          ) : (
            entries.map(([key, value]) => {
              if (key === "name") {
                return (
                  <p key={key}>
                    <strong>Name:</strong> {value}
                  </p>
                );
              }
              if (key === "phone") {
                return (
                  <p key={key}>
                    <strong>Phone:</strong>{" "}
                    <a href={`tel:${value}`}>{value}</a>
                  </p>
                );
              }
              if (key === "email") {
                return (
                  <p key={key}>
                    <strong>Email:</strong>{" "}
                    <a href={`mailto:${value}`}>{value}</a>
                  </p>
                );
              }
              // Social media
              const url = `https://${key}.com/${value}`;
              return (
                <p key={key}>
                  <strong>
                    {key.charAt(0).toUpperCase() + key.slice(1)}:
                  </strong>{" "}
                  <a href={url} target="_blank" rel="noreferrer">
                    {value}
                  </a>
                </p>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
