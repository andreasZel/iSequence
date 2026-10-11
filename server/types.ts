export type VideoStatus = 'queued' | 'generating' | 'encoding' | 'done' | 'failed' | 'cancelled';

export type Video = {
    id: string;
    name: string;
    prompt: string;
    status: VideoStatus;
    frameCount: number;
    framesDone: number;
    error: string | null;
    createdAt: string;
    updatedAt: string;
};

export type VideoPatch = Partial<Pick<Video, 'status' | 'framesDone' | 'error'>>;

export type Frame = {
    index: number;
    svg: string;
    png: Buffer;
};

export type ImageItem = {
    id: string;
    prompt: string;
    createdAt: string;
};

export type ClaudeContentBlock =
    | { type: 'text'; text: string }
    | { type: 'image'; source: { type: 'base64'; media_type: 'image/png'; data: string } };

export type ClaudeContent = ClaudeContentBlock[];

export type VideoEvent =
    | { type: 'frame'; videoId: string; index: number; frameCount: number }
    | { type: 'status'; videoId: string; status: VideoStatus }
    | { type: 'error'; videoId: string; message: string };
