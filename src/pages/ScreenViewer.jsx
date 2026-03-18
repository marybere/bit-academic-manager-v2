export default function ScreenViewer({ src, title }) {
  return (
    <iframe
      src={src}
      style={{
        width: '100%',
        height: '100vh',
        border: 'none',
        display: 'block'
      }}
      title={title}
    />
  )
}
