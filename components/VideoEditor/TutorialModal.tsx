'use client';

import { useState } from 'react';
import GuidedTourOverlay from './GuidedTourOverlay';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const tutorialSections = [
  {
    title: 'Connect & ingest',
    bullets: [
      'Use the toolbar’s “Connect & Ingest” button to pull in mock connector footage or upload local files.',
      'Every source tracks its own trim handles, metadata, and overlay counter so you can hop between videos without losing context.',
      'Proxy status + connector badges in the library make it easy to spot cloud assets vs. local imports.',
    ],
  },
  {
    title: 'Mine clips fast',
    bullets: [
      'Click “Auto-Mine Shots” on any active source to ask the AI miner for suggested clips.',
      'Accept suggestions to convert them into editable clips, or dismiss to keep things tidy.',
      'Each clip keeps the segments that generated it, so previews stay in sync even after trims move.',
    ],
  },
  {
    title: 'Design variations',
    bullets: [
      'Open “Variations” on a clip to try multiple overlay templates at once.',
      'Generated overlays stay in the existing canvas pipeline, so nothing changes about playback.',
      'Queue the strongest ideas for rendering directly from the panel.',
    ],
  },
  {
    title: 'Render & share',
    bullets: [
      'Fire off multiple variations to the Render Queue and keep editing—jobs update every couple seconds.',
      'Once ready, download placeholder outputs or swap in a real worker later without UI changes.',
      'Need to start over? Reset Workspace clears clips/sources while leaving connector metadata intact.',
    ],
  },
];

const tourSteps = [
  {
    targetId: 'automations',
    title: 'Command Center',
    description:
      'Kick off ingest, AI shot mining, and rendering from here. It is always visible, no matter which view you are on.',
  },
  {
    targetId: 'library',
    title: 'Video Library',
    description:
      'Add new footage, switch active sources, or spot connector badges + proxy readiness at a glance.',
  },
  {
    targetId: 'player',
    title: 'Trim & Preview',
    description:
      'Dial in in/out points, scrub the timeline, and preview overlays exactly as they’ll render.',
  },
  {
    targetId: 'clips',
    title: 'Clip & Variation Stack',
    description:
      'Manage clips per-source or across the whole project, open the variation builder, and clean up with Reset.',
  },
];

export default function TutorialModal({ isOpen, onClose }: TutorialModalProps) {
  const [isTourActive, setIsTourActive] = useState(false);

  if (!isOpen) return null;

  return (
    <>
      {isTourActive && (
        <GuidedTourOverlay
          steps={tourSteps}
          onSkip={() => setIsTourActive(false)}
          onClose={() => {
            setIsTourActive(false);
            onClose();
          }}
        />
      )}
      {!isTourActive && (
        <div
          className="fixed inset-0 bg-black/80 z-[1000] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <div
            className="bg-[#2a2a2a] p-8 rounded-2xl max-w-[780px] w-full max-h-[90vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h3 className="text-2xl font-semibold mb-1">
                  Automations + editing in four beats
                </h3>
                <p className="text-sm text-[#bbb] m-0">
                  Skim the highlights below or launch the guided tour if you’d like the UI
                  walkthrough.
                </p>
              </div>
              <button
                onClick={onClose}
                className="bg-[#444] border border-[#555] text-white text-xl cursor-pointer w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#555]"
                aria-label="Close tutorial"
              >
                ×
              </button>
            </div>

            <div className="space-y-5">
              {tutorialSections.map((section) => (
                <section
                  key={section.title}
                  className="bg-[#333] rounded-xl p-5 border border-[#3f3f3f]"
                >
                  <h4 className="text-lg font-semibold mb-3">{section.title}</h4>
                  <ul className="list-disc pl-5 space-y-2 text-sm text-[#ddd] m-0">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <div className="flex flex-wrap justify-end gap-3 mt-6">
              <button
                onClick={() => setIsTourActive(true)}
                className="bg-transparent border border-[#555] text-white px-5 py-2.5 rounded-lg cursor-pointer text-sm font-medium hover:border-[#777] transition-all"
              >
                Start guided tour
              </button>
              <button
                onClick={onClose}
                className="bg-[#0a84ff] text-white border-none px-5 py-2.5 rounded-lg cursor-pointer text-sm font-medium hover:bg-[#0066cc] transition-all"
              >
                Let’s build clips
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
