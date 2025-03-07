export const copyToClipboard = (text: string): boolean => {
  const {activeElement} = document
  const input = document.createElement("textarea")

  input.value = text // Use .value for textarea
  document.body.appendChild(input)
  input.select()

  let result = false
  try {
    result = document.execCommand("copy")
  } catch (err) {
    console.error("Failed to copy text to clipboard", err)
  }

  document.body.removeChild(input)
  ;(activeElement as HTMLElement)?.focus() // Optional chaining

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

  const {default: Compressor} = await import("compressorjs")

  return new Promise((resolve, reject) => {
    new Compressor(file as File, { // Explicit cast to File
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
}

export const listenForFile = (input: HTMLInputElement, onChange: (files: FileList | null) => void) => {
  input.addEventListener("change",  e => { // Removed async, as the callback is sync now
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

export const blobToFile = (blob: Blob, name?: string) => new File([blob], name || blob.name, {type: blob.type})

export const stripHtml = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, "text/html")
  return doc.body.textContent || ""
}

export const escapeHtml = (html: string): string => {
  const div = document.createElement("div")
  div.textContent = html // Use textContent to escape
  return div.innerHTML
}

export const isMobile =
  localStorage.mobile === 'true' || window.navigator.maxTouchPoints > 1 || window.innerWidth < 400 // Explicit boolean check

export const parseHex = (hex: string): number[] | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return null // Handle no match

  return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
}
