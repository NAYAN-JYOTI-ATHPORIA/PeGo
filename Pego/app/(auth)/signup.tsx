import React, { useState } from 'react';
import {
  View,
  Text,
  StatusBar,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';

import { router } from 'expo-router';

import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  createUserWithEmailAndPassword,
} from 'firebase/auth';

import { auth } from '../../src/services/firebase/FirebaseConfig';
import { createUserProfile } from '../../src/services/firebase/user/userService';


const SignUp = () => {

 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);


  // =========================
  // SIGN UP FUNCTION
  // =========================
  const handleSignUp = async () => {

    // Check empty fields
    if (!email.trim() || !password || !confirmPassword) {
      Alert.alert(
        'Missing Information',
        'Please fill in all fields.'
      );
      return;
    }


    // Check password length
    if (password.length < 6) {
      Alert.alert(
        'Weak Password',
        'Password must be at least 6 characters long.'
      );
      return;
    }


    // Check passwords
    if (password !== confirmPassword) {
      Alert.alert(
        'Password Error',
        'Passwords do not match.'
      );
      return;
    }


    try {

      setLoading(true);

      // Create Firebase account
      const userCredential =
        await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

      const user = userCredential.user;

      console.log('User created:', user.uid);

      try {
        await createUserProfile(
          user.uid,
          user.email || email.trim(),
          email.trim().split('@')[0]
        );
      } catch (profileErr) {
        console.warn('Could not save profile in Firestore:', profileErr);
      }

      Alert.alert(
        'Account Created',
        'Your Pego account has been created successfully.'
      );

      // Clear form
     
      setEmail('');
      setPassword('');
      setConfirmPassword('');

    } catch (error: any) {

      console.log('Firebase signup error:', error);

      let message = 'Something went wrong. Please try again.';

      switch (error.code) {

        case 'auth/email-already-in-use':
          message = 'This email is already registered.';
          break;

        case 'auth/invalid-email':
          message = 'Please enter a valid email address.';
          break;

        case 'auth/weak-password':
          message = 'Password is too weak.';
          break;

        case 'auth/network-request-failed':
          message = 'Please check your internet connection.';
          break;

        default:
          message = error.message || message;
      }

      Alert.alert(
        'Sign Up Failed',
        message
      );

    } finally {

      setLoading(false);

    }
  };


  return (
    <SafeAreaProvider>

      <SafeAreaView style={styles.safeArea}>

        <StatusBar
          barStyle="dark-content"
          backgroundColor="#e6ecf3"
        />


        <View style={styles.container}>


          {/* =========================
              TOP LOGO SECTION
          ========================== */}

          <View style={styles.topSection}>

            <Image
              source={require('../../assets/images/pegologo.png')}
              style={styles.logo}
              resizeMode="contain"
            />

            <Text style={styles.logoText}>
              Pego
            </Text>

          </View>



          {/* =========================
              WHITE BACKGROUND
          ========================== */}

          <View style={styles.bottomBackground}>


            {/* =========================
                BLUE FORM SECTION
            ========================== */}

            <View style={styles.formSection}>


              <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={
                  Platform.OS === 'ios'
                    ? 'padding'
                    : 'height'
                }
              >


                <ScrollView
                  style={styles.scrollView}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >


                  {/* TITLE */}

                  <Text style={styles.title}>
                    Create Account
                  </Text>


                  {/* SUBTITLE */}

                  <Text style={styles.subtitle}>
                    Sign up to continue with Pego
                  </Text>


                  {/* =========================
                      EMAIL
                  ========================== */}

                  <Text style={styles.inputLabel}>
                    Email
                  </Text>

                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email"
                    placeholderTextColor="#8a8a8a"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />



                  {/* =========================
                      PASSWORD
                  ========================== */}

                  <Text style={styles.inputLabel}>
                    Password
                  </Text>

                  <TextInput
                    style={styles.input}
                    placeholder="Enter your password"
                    placeholderTextColor="#8a8a8a"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                  />



                  {/* =========================
                      CONFIRM PASSWORD
                  ========================== */}

                  <Text style={styles.inputLabel}>
                    Confirm Password
                  </Text>

                  <TextInput
                    style={styles.input}
                    placeholder="Confirm your password"
                    placeholderTextColor="#8a8a8a"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    autoCapitalize="none"
                  />



                  {/* =========================
                      SIGN UP BUTTON
                  ========================== */}

                  <TouchableOpacity
                    style={[
                      styles.signupButton,
                      loading && styles.disabledButton,
                    ]}
                    activeOpacity={0.8}
                    onPress={handleSignUp}
                    disabled={loading}
                  >

                    {loading ? (

                      <ActivityIndicator
                        size="small"
                        color="#023E7D"
                      />

                    ) : (

                      <Text style={styles.signupButtonText}>
                        Create Account
                      </Text>

                    )}

                  </TouchableOpacity>



                  {/* =========================
                      LOGIN
                  ========================== */}

                  <View style={styles.loginContainer}>

                    <Text style={styles.loginText}>
                      Already have an account?
                    </Text>

                    <TouchableOpacity onPress={() => router.push('/(auth)/login')}>

                      <Text style={styles.loginLink}>
                        Login
                      </Text>

                    </TouchableOpacity>

                  </View>


                </ScrollView>

              </KeyboardAvoidingView>

            </View>

          </View>

        </View>

      </SafeAreaView>

    </SafeAreaProvider>
  );
};



const styles = StyleSheet.create({

  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },


  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },


  // =========================
  // TOP SECTION
  // =========================

  topSection: {
    height: '35%',
    backgroundColor: '#e6ecf3',

    alignItems: 'center',
    justifyContent: 'center',
  },


  logo: {
    width: 150,
    height: 150,

    shadowColor: '#000',

    shadowOffset: {
      width: 0,
      height: 2,
    },

    shadowOpacity: 0.25,
    shadowRadius: 3.84,

    elevation: 5,
  },


  logoText: {
    color: '#023E7D',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: -10,
  },


  // =========================
  // BOTTOM BACKGROUND
  // =========================

  bottomBackground: {
    flex: 1,
    backgroundColor: '#e6ecf3',
  },


  // =========================
  // FORM
  // =========================

  formSection: {
    flex: 1,

    backgroundColor: '#023E7D',

    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,

    paddingHorizontal: 24,
    paddingTop: 30,
  },


  keyboardView: {
    flex: 1,
  },


  scrollView: {
    flex: 1,
  },


  scrollContent: {
    paddingBottom: 40,
  },


  // =========================
  // TITLE
  // =========================

  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },


  subtitle: {
    fontSize: 15,
    color: '#d9e6f5',

    marginTop: 8,
    marginBottom: 20,
  },


  // =========================
  // INPUT LABEL
  // =========================

  inputLabel: {
    fontSize: 14,
    fontWeight: '600',

    color: '#ffffff',

    marginBottom: 7,
    marginTop: 10,
  },


  // =========================
  // INPUT
  // =========================

  input: {
    height: 50,

    backgroundColor: '#ffffff',

    borderRadius: 10,

    paddingHorizontal: 16,

    fontSize: 15,

    color: '#222222',

    borderWidth: 1,
    borderColor: '#dce3eb',
  },


  // =========================
  // SIGN UP BUTTON
  // =========================

  signupButton: {
    height: 52,

    backgroundColor: '#ffffff',

    borderRadius: 10,

    alignItems: 'center',
    justifyContent: 'center',

    marginTop: 24,
  },


  disabledButton: {
    opacity: 0.7,
  },


  signupButtonText: {
    color: '#023E7D',

    fontSize: 16,
    fontWeight: 'bold',
  },


  // =========================
  // LOGIN
  // =========================

  loginContainer: {
    flexDirection: 'row',

    justifyContent: 'center',
    alignItems: 'center',

    marginTop: 18,
  },


  loginText: {
    color: '#d9e6f5',
    fontSize: 14,
  },


  loginLink: {
    color: '#ffffff',

    fontSize: 14,
    fontWeight: 'bold',

    marginLeft: 5,
  },

});


export default SignUp;