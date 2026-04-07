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
  signInWithEmailAndPassword,
} from 'firebase/auth';

import { auth } from '../../src/services/firebase/FirebaseConfig';
import { ensureUserProfile } from '../../src/services/firebase/user/userService';


const Login = () => {

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);


  // =========================
  // LOGIN FUNCTION
  // =========================

  const handleLogin = async () => {

    // Check empty fields
    if (!email.trim() || !password) {
      Alert.alert(
        'Missing Information',
        'Please enter your email and password.'
      );
      return;
    }


    try {

      setLoading(true);

      // Firebase Login
      const userCredential =
        await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

      const user = userCredential.user;

      console.log('User logged in:', user.uid);

      try {
        await ensureUserProfile(
          user.uid,
          user.email || email.trim(),
          user.displayName || email.trim().split('@')[0],
          user.photoURL
        );
      } catch (profileErr) {
        console.warn('Could not sync profile in Firestore:', profileErr);
      }

      // Go to Chats
      router.replace('/(tabs)/chats');


    } catch (error: any) {

      console.log('Firebase login error:', error);

      let message =
        'Something went wrong. Please try again.';


      switch (error.code) {

        case 'auth/invalid-email':
          message =
            'Please enter a valid email address.';
          break;

        case 'auth/user-not-found':
          message =
            'No account found with this email.';
          break;

        case 'auth/wrong-password':
          message =
            'Incorrect password. Please try again.';
          break;

        case 'auth/invalid-credential':
          message =
            'Invalid email or password.';
          break;

        case 'auth/network-request-failed':
          message =
            'Please check your internet connection.';
          break;

        case 'auth/too-many-requests':
          message =
            'Too many failed attempts. Please try again later.';
          break;

        default:
          message =
            error.message || message;
      }


      Alert.alert(
        'Login Failed',
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
              BOTTOM BACKGROUND
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


                  {/* =========================
                      TITLE
                  ========================== */}

                  <Text style={styles.title}>
                    Welcome Back
                  </Text>


                  {/* =========================
                      SUBTITLE
                  ========================== */}

                  <Text style={styles.subtitle}>
                    Login to continue with Pego
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
                      FORGOT PASSWORD
                  ========================== */}

                  <TouchableOpacity
                    style={styles.forgotContainer}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.forgotText}>
                      Forgot Password?
                    </Text>
                  </TouchableOpacity>


                  {/* =========================
                      LOGIN BUTTON
                  ========================== */}

                  <TouchableOpacity
                    style={[
                      styles.loginButton,
                      loading && styles.disabledButton,
                    ]}
                    activeOpacity={0.8}
                    onPress={handleLogin}
                    disabled={loading}
                  >

                    {loading ? (

                      <ActivityIndicator
                        size="small"
                        color="#023E7D"
                      />

                    ) : (

                      <Text style={styles.loginButtonText}>
                        Login
                      </Text>

                    )}

                  </TouchableOpacity>


                  {/* =========================
                      SIGN UP
                  ========================== */}

                  <View style={styles.signupContainer}>

                    <Text style={styles.signupText}>
                      Don&apos;t have an account?
                    </Text>

                    <TouchableOpacity
                      onPress={() => router.replace('/(auth)/signup')}
                      activeOpacity={0.7}
                    >

                      <Text style={styles.signupLink}>
                        Sign Up
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
  // FORGOT PASSWORD
  // =========================

  forgotContainer: {
    alignItems: 'flex-end',

    marginTop: 10,
  },


  forgotText: {
    color: '#ffffff',

    fontSize: 14,
    fontWeight: '600',
  },


  // =========================
  // LOGIN BUTTON
  // =========================

  loginButton: {
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


  loginButtonText: {
    color: '#023E7D',

    fontSize: 16,
    fontWeight: 'bold',
  },


  // =========================
  // SIGN UP
  // =========================

  signupContainer: {
    flexDirection: 'row',

    justifyContent: 'center',
    alignItems: 'center',

    marginTop: 18,
  },


  signupText: {
    color: '#d9e6f5',

    fontSize: 14,
  },


  signupLink: {
    color: '#ffffff',

    fontSize: 14,
    fontWeight: 'bold',

    marginLeft: 5,
  },

});


export default Login;