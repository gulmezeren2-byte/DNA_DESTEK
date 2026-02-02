
import { loginUser } from '../authService';
import { deleteEkip } from '../ekipService';

// Mock Firebase Config
jest.mock('../../firebaseConfig', () => ({
    db: {},
    auth: {}
}));

// Mock Firebase Consts
jest.mock('../../constants', () => ({
    APP_CONFIG: {
        ADMIN_EMAILS: ['admin@test.com']
    }
}));

// Mock Firestore & Auth
const mockGetDoc = jest.fn();
const mockSetDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockSignIn = jest.fn();
const mockSignOut = jest.fn();
const mockOnAuthStateChanged = jest.fn();

jest.mock('firebase/firestore', () => ({
    getDoc: (...args: any[]) => mockGetDoc(...args),
    getDocs: (...args: any[]) => mockGetDocs(...args),
    deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
    setDoc: (...args: any[]) => mockSetDoc(...args),
    doc: jest.fn(),
    collection: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    updateDoc: jest.fn(),
    getDocFromServer: (...args: any[]) => mockGetDoc(...args), // Fallback to same mock
}));

jest.mock('firebase/auth', () => ({
    getAuth: jest.fn(),
    signInWithEmailAndPassword: (...args: any[]) => mockSignIn(...args),
    signOut: (...args: any[]) => mockSignOut(...args),
    onAuthStateChanged: (...args: any[]) => mockOnAuthStateChanged(...args),
    createUserWithEmailAndPassword: jest.fn(),
    initializeAuth: jest.fn(),
    getReactNativePersistence: jest.fn(),
}));

describe('Audit & Integrity Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Security: Login Logic', () => {
        it('should BLOCK deactivated users', async () => {
            // Setup
            mockSignIn.mockResolvedValue({
                user: { uid: 'user123', email: 'test@user.com' }
            });

            // Mock Firestore Profile -> Active = false
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({
                    id: 'user123',
                    email: 'test@user.com',
                    aktif: false, // DEACTIVATED
                    rol: 'teknisyen'
                })
            });

            // Execute
            const result = await loginUser('test@user.com', 'password');

            // Verify
            expect(result.success).toBe(false);
            expect(result.message).toContain('pasif');
            expect(mockSignOut).toHaveBeenCalled(); // Should assume safety logout
        });

        it('should ALLOW active users', async () => {
            // Setup
            mockSignIn.mockResolvedValue({
                user: { uid: 'user123', email: 'test@user.com' }
            });

            // Mock Firestore Profile -> Active = true
            mockGetDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({
                    id: 'user123',
                    email: 'test@user.com',
                    aktif: true, // ACTIVE
                    rol: 'teknisyen'
                })
            });

            // Execute
            const result = await loginUser('test@user.com', 'password');

            // Verify
            expect(result.success).toBe(true);
        });
    });

    describe('Integrity: Team Deletion', () => {
        it('should PREVENT deleting team with active tasks', async () => {
            // Mock Query Snapshot to return NOT EMPTY (Active tasks exist)
            mockGetDocs.mockResolvedValue({
                empty: false, // Has tasks!
                docs: [{ id: 'task1' }]
            });

            const result = await deleteEkip('team123');

            expect(result.success).toBe(false);
            expect(result.message).toContain('aktif talepler var');
            expect(mockDeleteDoc).not.toHaveBeenCalled();
        });

        it('should ALLOW deleting team with NO active tasks', async () => {
            // Mock Query Snapshot to return EMPTY (No tasks)
            mockGetDocs.mockResolvedValue({
                empty: true, // No tasks
                docs: []
            });

            const result = await deleteEkip('team123');

            expect(result.success).toBe(true);
            expect(mockDeleteDoc).toHaveBeenCalled();
        });
    });
});
