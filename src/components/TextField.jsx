import React from 'react'
import '../css/TextField.css'

const TextField = ({
  label,
  type = 'text',
  name,
  value,
  onChange,
  required = true
}) => (
  <div className="user-box">
    <input
      className="input"
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
    />
    <label>{label}</label>
  </div>
)

export default TextField
