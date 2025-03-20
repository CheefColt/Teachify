import express from 'express';
import jwt from 'jsonwebtoken';
import { Teacher } from '../models/Teacher';
import bcrypt from 'bcrypt';

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new teacher
// @access  Public
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Check if teacher exists
        const teacherExists = await Teacher.findOne({ email });
        if (teacherExists) {
            return res.status(400).json({ message: 'Teacher already exists' });
        }

        // Create teacher without manual hashing
        const teacher = await Teacher.create({
            name,
            email,
            password, // Pass the plain password
            role: 'instructor'  // Add default role
        });

        if (teacher) {
            // Log JWT_SECRET presence
            console.log('JWT_SECRET is set:', !!process.env.JWT_SECRET);

            // Log the generated token
            const token = generateToken(teacher);
            console.log('Generated token:', token);

            res.status(201).json({
                _id: teacher._id,
                name: teacher.name,
                email: teacher.email,
                role: teacher.role,
                token
            });
        }
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/auth/login
// @desc    Authenticate teacher & get token
// @access  Public
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check for teacher
        const teacher = await Teacher.findOne({ email });
        if (!teacher) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, teacher.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        res.json({
            _id: teacher._id,
            name: teacher.name,
            email: teacher.email,
            role: teacher.role,
            token: generateToken(teacher)
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Token generation function
const generateToken = (teacher: any) => {
    // Create payload with exact field names expected by auth middleware
    const payload = {
        id: teacher._id.toString(), // Convert ObjectId to string
        email: teacher.email,
        role: teacher.role || 'instructor'
    };
    
    console.log('Creating token payload:', payload);
    
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not defined in environment variables');
    }
    return jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );
};

export default router;