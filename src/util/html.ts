export const copyToClipboard = (text: string): boolean => {
  const {activeElement} = document
  const input = document.createElement("textarea")

  input.value = text
  document.body.appendChild(input)
  input.select()

  let result = false
  try {
    result = document.execCommand("copy")
  } catch (err) {
    console.error("Failed to copy text to clipboard", err)
  } finally {
    document.body.removeChild(input)
    ;(activeElement as HTMLElement)?.focus()
  }

  return result
}

export const stripExifData = async (
  file: File | DataTransferItem,
  {maxWidth = 2048, maxHeight = 2048} = {},
): Promise<File | Blob | null> => {
  if (window.DataTransferItem && file instanceof DataTransferItem) {
    file = file.getAsFile()
  }

  if (!file) {
    return null
  }

  try {
    const {default: Compressor} = await import("compressorjs")

    return await new Promise((resolve, reject) => {
      new Compressor(file as File, {
        maxWidth,
        maxHeight,
        convertSize: 10 * 1024 * 1024,
        success: resolve,
        error: e => {
          if (e.toString().includes("File or Blob")) {
            return resolve(file)
          }
          reject(e)
        },
      })
    })
  } catch (e) {
    console.error("Error stripping EXIF ", e)
    return file instanceof File ? file : null // Return original file if stripping fails
  }
}

export const listenForFile = (input: HTMLInputElement, onChange: (files: FileList | null) => void) => {
  input.addEventListener("change",  (e) => {
    const target = e.target as HTMLInputElement
    onChange(target.files)
  })
}

export const blobToString = async (blob: Blob): Promise<string | ArrayBuffer | null> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => resolve(reader.result)
    reader.readAsDataURL(blob)
  })

export const blobToFile = (blob: Blob, name?: string) => new File([blob], name || "file", {type: blob.type}) // Default name

export const stripHtml = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, "text/html")
  return doc.body.textContent || ""
}

export const escapeHtml = (html: string): string => {
  const div = document.createElement("div")
  div.textContent = html
  return div.innerHTML
}

export const isMobile =
  localStorage.mobile === 'true' || window.navigator.maxTouchPoints > 1 || window.innerWidth < 400

export const parseHex = (hex: string): number[] | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return null

  return result.slice(1, 4).map(channel => Number.parseInt(channel, 16)) as number[] // Type assertion
}
