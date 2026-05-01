export interface DevImagePickerProps {
  slug: string;
  heroImage?: string;
  thumbnailImage?: string;
  embeddedImages?: readonly string[];
  sourcePath: string;
}
