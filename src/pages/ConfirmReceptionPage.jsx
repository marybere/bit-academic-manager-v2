import { useEffect } from 'react'
import { useParams } from 'react-router-dom'

export default function ConfirmReceptionPage() {
  const { token } = useParams()

  useEffect(() => {
    window.location.href = `http://localhost:3000/api/requests/confirm/${token}`
  }, [token])

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Arial,sans-serif',background:'#f8fafc'}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:'48px'}}>⏳</div>
        <p style={{color:'#64748b',marginTop:'16px'}}>Confirming your reception...</p>
      </div>
    </div>
  )
}
