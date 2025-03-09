import { asynchandler } from "../utils/asynchandler.js";
import {ApiError} from "../utils/ApiError.js";
import { User } from "../models/user.model.js" 
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import {jwt} from 'jsonwebtoken'


const generateAccessAndRefreshToken = async(userId)=>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validatebeforeSave:false})

        return {accessToken , refreshToken}


    } catch (error) {
        throw new ApiError(500 , "Token generation failed")
        
    }
}
 
const registerUser = asynchandler(async (req , res) => {
   /*get user details from frontend , postman
    validation - not empty 
    check if user already exist (username , email ig)
    check for images, avatar etc 
    upload them to cloudinary get that link (ref)
    create user object -- create entry in db 
    remove password and refresh token from response 
    check for user creation first , kabhi null hee agaya response
    return res lol
   */

// req.body for data in frontend
    const {fullName , email , username , password} = req.body
    
    if(
        [fullName , email , username , password].some((field) =>
        field?.trim()==="")

    ){
        throw new ApiError(400 , "All fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{ username } ,  { email } ]
    })

    if (existedUser){
        throw new ApiError(409 , "User with same email or username exists")

    }

    const avatarLocalPath = req.files?.avatar[0]?.path
    const coverImageLocalPath = req.files?.coverImage[0]?.path

    if (!avatarLocalPath){
        throw new ApiError(400 , "Avatar File is required")
    
    }

    //upload on cloudinary 

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = coverImageLocalPath? await uploadOnCloudinary(coverImageLocalPath) : null

    if (!avatar){
        throw new ApiError(400 , "Avatar dede bhai")
    }

    const user  = await User.create({
        fullName ,
        avatar:avatar.url , 
        coverImage: coverImage?.url || "" , 
        email ,
        password ,
        username : username.toLowerCase()

    })

    const createdUser = await User.findById(user._id) .select(
        "-password -refreshToken"
    )
    
    if(!createdUser){
        throw new ApiError(500 , "Something went wrong user no")

    }

    return res.status(201).json(
        new ApiResponse(200 , createdUser , "User registered ")

    )
})


const loginUser = asynchandler(async (req , res) => {
    //take data from req.body
    // username or email 
    // find the user
    // check password 
    // access and refresh token 
    // send cookies 

    const {email , username , password} = req.body 
    if(!username && !email){
        throw new ApiError(400 , "Username or email is required")

    }

    //console.log({email , username , password} )
    const user = await User.findOne({
        $or: [{username} , {email}]
    })
    
    if (!user){
        throw new ApiError(404 , "User not found")
    }

    const inPasswordValid = await user.isPasswordCorrect(password)

    if (!inPasswordValid){
        throw new ApiError(401 , "Invalid User Credentials")
    }

    const {accessToken , refreshToken} = await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")


    const options = {
        httpOnly:true,
        secure : true
    }
    
    return res
    .status(200)
    .cookie("accessToken", accessToken , options)
    .cookie("refreshToken" , refreshToken , options)
    .json(new ApiResponse(200 ,{
        user:loggedInUser , accessToken
        ,refreshToken},
        "User logged in")
    )


})


const logoutUser = asynchandler(async (req , res) => {
    await User.findByIdAndUpdate(req.user._id , {
        $set:{
            refreshToken:undefined
        }

    }, 
    {
        new:true
    }
    
    
    )
    const options = {
        httpOnly:true,
        secure : true
    }

    return res
    .status(200)
    .clearCookie("accessToken" , options)
    .clearCookie("refreshToken" , options)
    .json(new ApiResponse(200 , {} , "User logged out")
    )

    
})

const refresAccessToken = asynchandler(async (req , res) => {
    const {incomingRefreshToken} = req.cookies || req.body

    if(!refreshToken){
        throw new ApiError(401 , "Unauthorized request / Invalid refresh token")
    }

    try {
        const decodedToken = jwt.verify(refreshToken , process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id)
    
        if(!user){
            throw new ApiError(401 , "Invalid refresh token")
        }
    
        if(user?.refreshToken !== incomingRefreshToken){
            throw new ApiError(401 , "Invalid refresh token expired or used")
        }
        return res
        .status(200)
        .json(new ApiResponse(200 , {accessToken} , "Access token refreshed")
        )
    
    
        const options = {    
            httpOnly:true,  
            secure : true 
        }
        const {accessToken , newrefreshToken} =await generateAccessAndRefreshToken(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken , options)
        .cookie("refreshToken" , newrefreshToken , options)
        .json(new ApiResponse(200 , {accessToken , newrefreshToken} , "Access token refreshed")
        )
    } catch (error) {
        throw new ApiError(401 ,"Invalid refresh token try catch")

        
    }

})

export {registerUser}
export {loginUser}
export {logoutUser}
export {refresAccessToken}