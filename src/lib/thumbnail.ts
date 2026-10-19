import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// MealCard shows the photo at 56×56; 168 px keeps it sharp on 3x screens
const THUMBNAIL_SIZE = 168;

/**
 * Center-crops the image to a square and shrinks it to a small JPEG data URI (~5-10 KB),
 * small enough to store inside the meal in Firestore and show on any device.
 */
export async function createMealThumbnail(uri: string): Promise<string> {
  const original = await ImageManipulator.manipulate(uri).renderAsync();
  const side = Math.min(original.width, original.height);

  const thumbnail = await ImageManipulator.manipulate(original)
    .crop({
      originX: Math.floor((original.width - side) / 2),
      originY: Math.floor((original.height - side) / 2),
      width: side,
      height: side,
    })
    .resize({ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE })
    .renderAsync();

  const { base64 } = await thumbnail.saveAsync({ format: SaveFormat.JPEG, compress: 0.6, base64: true });
  if (!base64) throw new Error('Thumbnail could not be encoded');
  return `data:image/jpeg;base64,${base64}`;
}
