#ifndef __JSON_HPP
#define __JSON_HPP

#include <string>
#include <ostream>
#include <fstream>
#include <sstream>
#include <memory>
#include <stack>

void write_json_str(std::ostream &os, const std::string &str) {
    os << "\"";
    for (size_t i = 0; i < str.size(); ++i) {
        if (str[i] == '"') os << "\\\"";
        else os << str[i];
    }
    os << "\"";
}

class JsonWriter {
public:
    typedef std::runtime_error error;

    JsonWriter(std::ostream &out) : os(out) { init_state(); }
    JsonWriter(std::string filename) :
        p_file(new std::ofstream(filename.c_str())),
        os(*p_file.get())
    { init_state(); }
    
    JsonWriter() :
        p_stringstream(new std::ostringstream()),
        os(*p_stringstream.get())
    { init_state(); }
    
    JsonWriter& begin(char opening_bracket) {
        begin_token(OPENING);
        
        char closing_bracket;
        if (opening_bracket == '{') closing_bracket = '}';
        else if (opening_bracket == '[') closing_bracket = ']';
        else throw error("invalid bracket");
        
        brackets.push(closing_bracket);
        
        os << opening_bracket;
        return *this;
    }
    
    JsonWriter& end(char closing_bracket) {
        begin_token(CLOSING);
        
        if (brackets.top() != closing_bracket) throw error("unmatched bracket");
        brackets.pop();
        
        os << closing_bracket;
        last_token = VALUE;
        return *this;
    }
    
    JsonWriter& key(const char *key) {
        begin_token(KEY);
        write_string(key);
        os << ':';
        return *this;
    }
    
    JsonWriter& value(const char *str) {
        begin_token(VALUE);
        write_string(str);
        return *this;
    }
    
    JsonWriter& null_value() {
        begin_token(VALUE);
        os << "null";
        return *this;
    }
    
    JsonWriter& value(int n) {
        begin_token(VALUE);
        os << n;
        return *this;
    }
    
    JsonWriter& value(double n) {
        begin_token(VALUE);
        os << n;
        return *this;
    }
    
    JsonWriter& value(bool t) {
        begin_token(VALUE);
        if (t) os << "true";
        else os << "false";
        return *this;
    }
    
    size_t bytes_written() { return file().tellp(); }
    std::string to_string() { return stringstream().str(); }
    
private:
    const std::auto_ptr<std::ofstream> p_file;
    const std::auto_ptr<std::ostringstream> p_stringstream;
    std::ostream &os;
    
    void init_state() { last_token = NONE; }
    
    std::ostringstream& stringstream() {
        assert(p_stringstream.get() != NULL);
        return *p_stringstream.get();
    }
    
    std::ofstream& file() {
        assert(p_file.get() != NULL);
        return *p_file.get();
    }
    
    enum Token { NONE, OPENING, KEY, VALUE, CLOSING } last_token;
    
    std::stack<char> brackets;
    
    void write_string(const char *str) {
        os << '"';
        while(*str != '\0') {
            if (*str == '"') os << "\\\"";
            else os << *str;
            str++;
        }
        os << '"';
    }
    
    void begin_token(Token token) {
        
        if (brackets.empty()) {
            if (last_token != NONE) throw error("cannot re-open final bracket");
            if (token == OPENING) last_token = token;
            else throw error("expected opening bracket");
            return;
        }
        
        if (token == KEY) {
            if (brackets.top() != '}' || last_token == KEY)
                throw error("unexpected key");
        }
        else {
            if (token == CLOSING) {
                if (brackets.empty()) throw error("bracket not open");
            }
            else {
                if (brackets.top() == '}' && last_token != KEY)
                    throw error("expected key");
            }
        }
        
        if (token != CLOSING && last_token != OPENING && last_token != KEY) {
            os << ',';
        }
        
        last_token = token;
    }
};

#endif
