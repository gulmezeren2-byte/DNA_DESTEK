
import { validateEmail, validatePassword } from '../validation';

describe('Validation Utils', () => {
    describe('validateEmail', () => {
        it('should return true for valid emails', () => {
            expect(validateEmail('test@example.com')).toBe(true);
            expect(validateEmail('user.name@domain.co.uk')).toBe(true);
        });

        it('should return false for invalid emails', () => {
            expect(validateEmail('invalid-email')).toBe(false);
            expect(validateEmail('@domain.com')).toBe(false);
            expect(validateEmail('user@')).toBe(false);
            expect(validateEmail('')).toBe(false);
        });
    });

    describe('validatePassword', () => {
        it('should return true for passwords with 6 or more characters', () => {
            expect(validatePassword('123456')).toBe(true);
            expect(validatePassword('password123')).toBe(true);
        });

        it('should return false for passwords shorter than 6 characters', () => {
            expect(validatePassword('12345')).toBe(false);
            expect(validatePassword('')).toBe(false);
        });
    });
});
