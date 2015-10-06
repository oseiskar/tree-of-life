#ifndef __JSON_HPP
#define __JSON_HPP

#include <string>
#include <ostream>

void write_json_str(std::ostream &os, const std::string &str) {
    os << "\"";
    for (size_t i = 0; i < str.size(); ++i) {
        if (str[i] == '"') os << "\\\"";
        else os << str[i];
    }
    os << "\"";
}

#endif
