/**
 * O PUT pré-assinado direto no armazenamento (Imagens RN04), com o progresso do envio
 * (o fetch não dá o progresso do upload). O tamanho sai do Blob: o navegador não deixa
 * definir o Content-Length. Rejeita na falha de rede ou com status fora de 2xx.
 */
export function putFile({
  url,
  blob,
  contentType,
  onProgress,
}: {
  url: string;
  blob: Blob;
  contentType: string;
  onProgress?: (fraction: number) => void;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url);
    request.setRequestHeader('Content-Type', contentType);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new Error(`PUT ${request.status}`));
    request.onerror = () => reject(new Error('rede'));
    request.send(blob);
  });
}
