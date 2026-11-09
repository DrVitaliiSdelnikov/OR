import { HIT_MARK_COUNT } from './scene.model';

export interface SceneImages {
  sky: HTMLImageElement;
  berm: HTMLImageElement;
  ground: HTMLImageElement;
  gong: HTMLImageElement;
  grass: HTMLImageElement;
  hitMarks: HTMLImageElement[];
}

const SCENE_DIR = 'scene';

function loadImage(name: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`scene image ${name} failed to load`));
    image.src = `${SCENE_DIR}/${name}.webp`;
  });
}

let pending: Promise<SceneImages | null> | null = null;

export function loadSceneImages(): Promise<SceneImages | null> {
  pending ??= Promise.all([
    loadImage('sky'),
    loadImage('berm'),
    loadImage('ground'),
    loadImage('gong'),
    loadImage('grass'),
    Promise.all(Array.from({ length: HIT_MARK_COUNT }, (_, index) => loadImage(`mark-${index}`))),
  ])
    .then(([sky, berm, ground, gong, grass, hitMarks]) => ({ sky, berm, ground, gong, grass, hitMarks }))
    .catch(() => null);
  return pending;
}
