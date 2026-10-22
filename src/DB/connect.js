import mongoose from 'mongoose';

const connectDB = async () => {
    try {
      
        await mongoose.connect(process.env.DB_LOCAL); 
        console.log(`Database connected successfully... 💜`);
    } catch (error) {
        console.error(`Fail to connect on database: ${error.message}`);
    }
};

export default connectDB; 