// @vitest-environment jsdom
/** The published PDF chunk supplies compatibility methods in an isolated browser realm. */
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { createContext, runInContext } from 'node:vm'
import { expect, it } from 'vitest'

const chunkPath = resolve(import.meta.dirname, '../lib/client.pdf.js')
const require = createRequire(import.meta.url)

it.skipIf(!existsSync(chunkPath))('initializes without native Map upsert or typed-array hex support', () => {
  let initialized = false
  const context = createContext({
    document, navigator, Blob, Response, URL, TextEncoder, TextDecoder, DOMException,
    // No drawing occurs here; the real-library smoke owns canvas rendering.
    DOMMatrix: class { readonly a = 1 },
    window: {
      requestAnimationFrame: () => 0,
      __ModuleLoader__: { load: (registration: {
        factory: (resolve: (specifier: string) => unknown) => { PdfBody: unknown }
      }) => {
        const loaded = registration.factory((specifier) => {
          if (specifier === '@deepseek-ai/dsh-client-ui-primitives') return {}
          if (specifier === 'react' || specifier === 'react/jsx-runtime') return require(specifier)
          throw new Error(`Unexpected PDF browser dependency: ${specifier}`)
        })
        expect(typeof loaded.PdfBody).toBe('function')
        initialized = true
      } },
    },
  })
  runInContext('delete Map.prototype.getOrInsertComputed; delete Uint8Array.prototype.toHex', context)
  runInContext(readFileSync(chunkPath, 'utf8'), context)
  expect(initialized).toBe(true)
  expect(runInContext('new Map().getOrInsertComputed("key", () => 7)', context)).toBe(7)
  expect(runInContext('new Uint8Array([0, 255]).toHex()', context)).toBe('00ff')
})
