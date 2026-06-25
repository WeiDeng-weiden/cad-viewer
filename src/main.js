import { DxfViewer } from 'dxf-viewer'
import * as THREE from 'three'
import './style.css'

// ─── Elements ────────────────────────────────────────────────────────────────
const $  = id => document.getElementById(id)
const el = {
  dropZone:      $('drop-zone'),
  dzInner:       $('dz-inner'),
  fileInput:     $('file-input'),
  btnOpen:       $('btn-open'),
  btnOpenAnother:$('btn-open-another'),
  btnCloseFile:  $('btn-close-file'),
  viewerLayout:  $('viewer-layout'),
  viewerCanvas:  $('viewer-canvas'),
  loadingOverlay:$('loading-overlay'),
  loadingText:   $('loading-text'),
  fileBadge:     $('file-badge'),
  fileNameBadge: $('file-name-badge'),
  toolInfo:      $('tool-info'),
  sidebar:       $('sidebar'),
  layersList:    $('layers-list'),
  layerCount:    $('layer-count'),
  btnLayersAll:  $('btn-layers-all'),
  btnLayersNone: $('btn-layers-none'),
  btnLayers:     $('btn-layers'),
  btnZoomIn:     $('btn-zoom-in'),
  btnZoomOut:    $('btn-zoom-out'),
  btnFit:        $('btn-fit'),
  dwgModal:      $('dwg-modal'),
  btnModalClose: $('btn-modal-close'),
  toast:         $('toast'),
  toastMsg:      $('toast-msg'),
  toastClose:    $('toast-close'),
}

// ─── State ────────────────────────────────────────────────────────────────────
let viewer = null
let layerVisibility = {}  // name → bool

// ─── Viewer creation ─────────────────────────────────────────────────────────
function createViewer() {
  if (viewer) return

  viewer = new DxfViewer(el.viewerCanvas, {
    clearColor: new THREE.Color(0x111418),
    autoResize: true,
    colorCorrection: true,
    sceneOptimizing: {
      mergeLines: true,
      simplifyColorDiffuse: true,
    },
  })

  viewer.Subscribe('loaded', ({ numEntities, numBlocksUsed }) => {
    hideLoading()
    updateLayers()
    const msg = `${numEntities.toLocaleString()} 个实体`
    el.toolInfo.textContent = msg
    if (numBlocksUsed) el.toolInfo.textContent += ` · ${numBlocksUsed} 个块`
  })

  viewer.Subscribe('error', errMsg => {
    hideLoading()
    showToast('加载失败: ' + errMsg)
  })
}

// ─── Load file ────────────────────────────────────────────────────────────────
async function loadFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()

  if (ext === 'dwg') {
    showDwgModal()
    return
  }

  if (ext !== 'dxf') {
    showToast(`不支持 ".${ext}" 格式，请使用 .dxf 文件`)
    return
  }

  await loadDXF(file)
}

async function loadDXF(file) {
  const url = URL.createObjectURL(file)

  try {
    showLoading('正在解析文件…')
    createViewer()

    // Switch to viewer layout
    el.dropZone.style.display = 'none'
    el.viewerLayout.style.display = 'flex'
    el.fileBadge.style.display = 'flex'
    el.fileNameBadge.textContent = file.name
    el.toolInfo.textContent = ''
    el.layersList.innerHTML = ''

    // Wait for container to be visible before loading
    await new Promise(r => requestAnimationFrame(r))

    await viewer.Load({ url, fonts: [] })
  } catch (err) {
    hideLoading()
    showToast('加载失败: ' + (err?.message ?? String(err)))
  } finally {
    URL.revokeObjectURL(url)
    // Reset file input so same file can be reopened
    el.fileInput.value = ''
  }
}

// ─── Layers ───────────────────────────────────────────────────────────────────
function updateLayers() {
  if (!viewer) return
  const layers = viewer.GetLayers() ?? []

  el.layerCount.textContent = layers.length
  el.layersList.innerHTML = ''
  layerVisibility = {}

  layers.forEach(layer => {
    layerVisibility[layer.name] = true

    const row = document.createElement('div')
    row.className = 'layer-row'
    row.dataset.layer = layer.name

    // Color swatch
    const colorHex = (layer.color ?? 0xffffff)
    const swatchColor = '#' + colorHex.toString(16).padStart(6, '0')
    const swatch = document.createElement('span')
    swatch.className = 'layer-swatch'
    swatch.style.background = swatchColor

    // Checkbox
    const cb = document.createElement('input')
    cb.type = 'checkbox'
    cb.checked = true
    cb.className = 'layer-cb'
    cb.addEventListener('change', () => {
      layerVisibility[layer.name] = cb.checked
      viewer.SetLayerVisibility(layer.name, cb.checked)
      row.classList.toggle('hidden-layer', !cb.checked)
    })

    // Name
    const name = document.createElement('span')
    name.className = 'layer-name'
    name.textContent = layer.name || '0'
    name.title = layer.name || '0'

    row.append(cb, swatch, name)
    el.layersList.appendChild(row)
  })
}

function setAllLayers(visible) {
  if (!viewer) return
  el.layersList.querySelectorAll('.layer-row').forEach(row => {
    const name = row.dataset.layer
    const cb = row.querySelector('.layer-cb')
    cb.checked = visible
    layerVisibility[name] = visible
    viewer.SetLayerVisibility(name, visible)
    row.classList.toggle('hidden-layer', !visible)
  })
}

// ─── Controls ─────────────────────────────────────────────────────────────────
function closeFile() {
  viewer?.Clear()
  el.viewerLayout.style.display = 'none'
  el.dropZone.style.display = 'flex'
  el.fileBadge.style.display = 'none'
  el.toolInfo.textContent = ''
  el.layersList.innerHTML = ''
  el.layerCount.textContent = '0'
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function showLoading(msg = '加载中…') {
  el.loadingText.textContent = msg
  el.loadingOverlay.style.display = 'flex'
}
function hideLoading() {
  el.loadingOverlay.style.display = 'none'
}

function showDwgModal() {
  el.dwgModal.style.display = 'flex'
}

let toastTimer = null
function showToast(msg) {
  el.toastMsg.textContent = msg
  el.toast.style.display = 'flex'
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { el.toast.style.display = 'none' }, 6000)
}

// ─── Keyboard shortcuts ───────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (!viewer) return
  if (e.key === '+' || e.key === '=') viewer.Zoom?.(0.8)
  if (e.key === '-' || e.key === '_') viewer.Zoom?.(1.25)
  if (e.key === 'f' || e.key === 'F') viewer.FitView?.(5, 5, 5, 5)
})

// ─── Event bindings ───────────────────────────────────────────────────────────
el.btnOpen.addEventListener('click', () => el.fileInput.click())
el.btnOpenAnother.addEventListener('click', () => el.fileInput.click())
el.fileInput.addEventListener('change', e => {
  const file = e.target.files[0]
  if (file) loadFile(file)
})

el.btnCloseFile.addEventListener('click', closeFile)

// Drag & drop on drop zone
el.dropZone.addEventListener('dragover', e => {
  e.preventDefault()
  el.dzInner.classList.add('drag-active')
})
el.dropZone.addEventListener('dragleave', e => {
  if (!el.dropZone.contains(e.relatedTarget)) {
    el.dzInner.classList.remove('drag-active')
  }
})
el.dropZone.addEventListener('drop', e => {
  e.preventDefault()
  el.dzInner.classList.remove('drag-active')
  const file = e.dataTransfer.files[0]
  if (file) loadFile(file)
})

// Also allow drop anywhere when viewer is open
document.addEventListener('dragover', e => e.preventDefault())
document.addEventListener('drop', e => {
  e.preventDefault()
  const file = e.dataTransfer.files[0]
  if (file) loadFile(file)
})

// Toolbar
el.btnZoomIn.addEventListener('click', () => viewer?.Zoom?.(0.8))
el.btnZoomOut.addEventListener('click', () => viewer?.Zoom?.(1.25))
el.btnFit.addEventListener('click', () => viewer?.FitView?.(5, 5, 5, 5))

el.btnLayers.addEventListener('click', () => {
  el.sidebar.classList.toggle('sidebar-open')
  el.btnLayers.classList.toggle('active')
})
el.btnLayersAll.addEventListener('click', () => setAllLayers(true))
el.btnLayersNone.addEventListener('click', () => setAllLayers(false))

// DWG modal
el.btnModalClose.addEventListener('click', () => {
  el.dwgModal.style.display = 'none'
})
el.dwgModal.addEventListener('click', e => {
  if (e.target === el.dwgModal) el.dwgModal.style.display = 'none'
})

// Toast
el.toastClose.addEventListener('click', () => { el.toast.style.display = 'none' })
