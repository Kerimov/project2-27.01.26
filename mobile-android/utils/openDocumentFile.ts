import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Linking, Platform } from 'react-native';

function extensionForMime(mime: string, fileName?: string): string {
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('png')) return 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('webp')) return 'webp';
  const fromName = fileName?.match(/\.([a-z0-9]+)$/i)?.[1];
  return fromName || 'bin';
}

function parseDataUrl(dataUrl: string): { mime: string; base64: string } | null {
  const match = dataUrl.match(/^data:([^;,]+)?(?:;[^,]*)?;base64,(.+)$/s);
  if (!match) return null;
  return { mime: match[1] || 'application/octet-stream', base64: match[2] };
}

/**
 * Открывает документ: http(s) — через Linking, data: — во временный файл + Share/открытие.
 */
export async function openDocumentFile(
  fileUrl: string,
  options?: { fileName?: string; documentId?: string }
): Promise<void> {
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    const can = await Linking.canOpenURL(fileUrl);
    if (!can) throw new Error('Нельзя открыть эту ссылку на устройстве');
    await Linking.openURL(fileUrl);
    return;
  }

  if (!fileUrl.startsWith('data:')) {
    throw new Error('Неподдерживаемый формат файла');
  }

  const parsed = parseDataUrl(fileUrl);
  if (!parsed) throw new Error('Не удалось прочитать файл');

  const ext = extensionForMime(parsed.mime, options?.fileName);
  const safeId = (options?.documentId || Date.now().toString()).replace(/[^a-zA-Z0-9_-]/g, '');
  const dir = FileSystem.cacheDirectory;
  if (!dir) throw new Error('Кэш файлов недоступен');

  const localPath = `${dir}document-${safeId}.${ext}`;
  await FileSystem.writeAsStringAsync(localPath, parsed.base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const fileUri = localPath.startsWith('file://') ? localPath : `file://${localPath}`;

  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    const available = await Sharing.isAvailableAsync();
    if (available) {
      await Sharing.shareAsync(fileUri, {
        mimeType: parsed.mime,
        dialogTitle: options?.fileName || 'Документ',
        UTI: parsed.mime.includes('pdf') ? 'com.adobe.pdf' : undefined,
      });
      return;
    }
  }

  const canOpenFile = await Linking.canOpenURL(fileUri);
  if (canOpenFile) {
    await Linking.openURL(fileUri);
    return;
  }

  throw new Error('На устройстве нет приложения для просмотра этого файла');
}

export function isImageFileUrl(fileUrl: string, fileType?: string): boolean {
  if (fileType?.includes('image')) return true;
  return /^data:image\//i.test(fileUrl);
}
