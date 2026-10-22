export const validation = (schema) => {
    return (req, res, next) => {
        const data = { ...req.body, ...req.params, ...req.query };
        const { error } = schema.validate(data, { abortEarly: false });
        
        if (error) {
            const errorMessages = error.details.map(err => err.message);
            return res.status(400).json({ message: "Validation Error", errors: errorMessages });
        }
        next();
    };
};