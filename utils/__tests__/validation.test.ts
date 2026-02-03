
import { isStrongPassword, isValidEmail } from '../validation';

describe('Validation Utils', () => {
    describe('isValidEmail', () => {
        it('should return true for valid emails', () => {
            expect(isValidEmail('test@example.com')).toBe(true);
            expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
        });

        it('should return false for invalid emails', () => {
            expect(isValidEmail('invalid-email')).toBe(false);
            expect(isValidEmail('@domain.com')).toBe(false);
            expect(isValidEmail('user@')).toBe(false);
            expect(isValidEmail('')).toBe(false);
        });
    });

    describe('isStrongPassword', () => {
        it('should return true for passwords with 6 or more characters', () => {
            expect(isStrongPassword('123456').valid).toBe(true);
            expect(isStrongPassword('password123').valid).toBe(true);
        });

        it('should return false for passwords shorter than 6 characters', () => {
            expect(isStrongPassword('12345').valid).toBe(false);
            expect(isStrongPassword('').valid).toBe(false);
        });
    });
});
