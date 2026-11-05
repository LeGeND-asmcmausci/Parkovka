/**
 * User model types for the Smart Parking Management System.
 * 
 * @author Principal Backend Engineer
 * @version 0.1.0
 */

export interface User {
  id: string
  name: string | null
  email: string
  passwordHash: string
  role: "ADMIN" | "GUARD" | "USER"
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED"
  phone: string | null
  licensePlate: string | null
  profileImage: string | null
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
}