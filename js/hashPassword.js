import bcrypt from 'bcrypt';

const adminPassword = 'Madrid1432@@#'; 
const saltRounds = 10;


bcrypt.hash(adminPassword, saltRounds, (err, hash) => {
    if (err) {
        console.error('Error hashing password:', err);
        return;
    }
    console.log('Hashed password:', hash);
});
