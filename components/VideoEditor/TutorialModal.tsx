'use client';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const tutorialSections = [
  {
    title: 'Import & Manage Sources',
    bullets: [
      'Use the Video Library to add multiple video files at once.',
      'Each source remembers its own trim markers, duration, and clip numbering.',
      'Re-import a file anytime to relink previews if the tab was refreshed.',
    ],
  },
  {
    title: 'Create Clips Per Video',
    bullets: [
      'Set in/out points on the active source and press “Create Clip”.',
      'Every clip stores its originating video so you can return later and keep editing.',
      'Duplicate clips to iterate on text overlays or timing tweaks.',
    ],
  },
  {
    title: 'Cross-Video Combinations',
    bullets: [
      'Switch the Clip Variations scope to “All Clips” to select clips from different videos.',
      'Combine them to build a multi-source sequence; playback swaps videos automatically.',
      'Same-video combines still respect that source’s clip counter.',
    ],
  },
  {
    title: 'Preview & Overlays',
    bullets: [
      'Preview any clip to loop through its segments and see overlay text in context.',
      'Add styled captions with the Text Overlay editor—saved per clip.',
      'Use the canvas overlay in preview mode to verify placement.',
    ],
  },
  {
    title: 'Housekeeping',
    bullets: [
      'Reset the workspace to remove all sources and clips.',
      'Removing a source also removes its clips and releases memory.',
      'Everything (except raw files) syncs to localStorage for easy restoration.',
    ],
  },
];

export default function TutorialModal({ isOpen, onClose }: TutorialModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 z-[1000] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#2a2a2a] p-8 rounded-2xl max-w-[720px] w-full max-h-[90vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h3 className="text-2xl font-semibold mb-1">How everything fits together</h3>
            <p className="text-sm text-[#bbb] m-0">
              Follow these steps to move from raw footage to shareable clips without leaving the
              browser.
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
            <div
              key={section.title}
              className="bg-[#333] rounded-xl p-5 border border-[#3f3f3f]"
            >
              <h4 className="text-lg font-semibold mb-3">{section.title}</h4>
              <ul className="list-disc pl-5 space-y-2 text-sm text-[#ddd] m-0">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="bg-[#0a84ff] text-white border-none px-5 py-2.5 rounded-lg cursor-pointer text-sm font-medium hover:bg-[#0066cc] transition-all"
          >
            Let’s build clips
          </button>
        </div>
      </div>
    </div>
  );
}
